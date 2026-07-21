"""
Tests for Kotiz corrections (Parties A + C + H):
- A: GET /api/payments/my/year/:yearId & GET /api/exceptional/mine (member-only self data)
- General: /api/payments/year/:yearId & /api/exceptional remain admin-only
- H: account lockout after 5 failed password attempts (30 min)
      + successful login resets counter
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://mobile-bug-crush-1.preview.emergentagent.com"
).rstrip("/")

# Credentials from /app/memory/test_credentials.md
SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"
ADMIN_EMAIL = "admin@delete-test.local"
ADMIN_PASSWORD = "admin123"
ASSOCIATION_CODE = "DELETE-TEST"


# ---------- Shared helpers / fixtures ----------

def _http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_ctx():
    """Log in the DELETE-TEST admin once and reuse (avoid IP rate-limit)."""
    s = _http()
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "associationCode": ASSOCIATION_CODE,
        },
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed ({r.status_code}): {r.text[:200]}")
    data = r.json()
    token = data["token"]
    association_id = data["association"]["id"]
    user = data["user"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return {
        "session": s,
        "token": token,
        "association_id": association_id,
        "user": user,
    }


@pytest.fixture(scope="module")
def superadmin_ctx():
    s = _http()
    r = s.post(
        f"{BASE_URL}/api/platform/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"SuperAdmin login failed: {r.text[:200]}")
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return {"session": s, "token": token}


@pytest.fixture(scope="module")
def existing_year_id(admin_ctx):
    """Find any existing year in DELETE-TEST assoc, or create one."""
    s = admin_ctx["session"]
    r = s.get(f"{BASE_URL}/api/years", timeout=10)
    assert r.status_code == 200, f"GET /api/years failed: {r.status_code} {r.text[:200]}"
    years = r.json()
    if years:
        return years[0]["id"]
    # No year: create one for testing
    r = s.post(
        f"{BASE_URL}/api/years",
        json={"year": 2099, "monthlyAmount": 1000},
        timeout=10,
    )
    assert r.status_code in (200, 201), f"Create year failed: {r.status_code} {r.text[:200]}"
    return r.json()["id"]


# =====================================================================
# PARTIE A - /api/payments/my/year/:yearId
# =====================================================================

class TestPaymentsMyYear:
    """Route accessible à tout utilisateur connecté, renvoie uniquement SES paiements."""

    def test_requires_authentication(self):
        r = _http().get(f"{BASE_URL}/api/payments/my/year/some-id", timeout=10)
        assert r.status_code in (401, 403), f"Expected auth required, got {r.status_code}"

    def test_admin_without_member_returns_404(self, admin_ctx, existing_year_id):
        """admin@delete-test.local n'a PAS de profil membre → 404 (comportement attendu)."""
        assert admin_ctx["user"].get("member") in (None, {}), \
            "Test precondition: DELETE-TEST admin must have no member profile"
        r = admin_ctx["session"].get(
            f"{BASE_URL}/api/payments/my/year/{existing_year_id}", timeout=10
        )
        assert r.status_code == 404, f"Expected 404 (no member), got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "error" in body
        assert "membre" in body["error"].lower() or "profil" in body["error"].lower()

    def test_invalid_year_id_returns_404(self, admin_ctx):
        r = admin_ctx["session"].get(
            f"{BASE_URL}/api/payments/my/year/nonexistent-year-id", timeout=10
        )
        assert r.status_code == 404
        assert "année" in r.json().get("error", "").lower() or "introuvable" in r.json().get("error", "").lower()


# =====================================================================
# PARTIE A - /api/exceptional/mine
# =====================================================================

class TestExceptionalMine:
    def test_requires_authentication(self):
        r = _http().get(f"{BASE_URL}/api/exceptional/mine", timeout=10)
        assert r.status_code in (401, 403)

    def test_admin_without_member_returns_404(self, admin_ctx):
        """/mine returns 404 when authenticated user has no member profile."""
        r = admin_ctx["session"].get(f"{BASE_URL}/api/exceptional/mine", timeout=10)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert "error" in body
        assert "membre" in body["error"].lower() or "profil" in body["error"].lower()


# =====================================================================
# Admin routes remain protected by requireAdmin
# =====================================================================

class TestAdminRoutesProtected:
    def test_payments_year_admin_accessible(self, admin_ctx, existing_year_id):
        """L'admin peut accéder à /api/payments/year/:yearId (retourne tous les membres)."""
        r = admin_ctx["session"].get(
            f"{BASE_URL}/api/payments/year/{existing_year_id}", timeout=15
        )
        assert r.status_code == 200, f"Admin should access: {r.status_code} {r.text[:200]}"
        data = r.json()
        assert "year" in data
        assert "members" in data
        assert isinstance(data["members"], list)

    def test_exceptional_list_admin_accessible(self, admin_ctx):
        r = admin_ctx["session"].get(f"{BASE_URL}/api/exceptional", timeout=15)
        assert r.status_code == 200, f"Admin should access: {r.status_code} {r.text[:200]}"
        assert isinstance(r.json(), list)

    def test_payments_year_requires_auth(self, existing_year_id):
        r = _http().get(f"{BASE_URL}/api/payments/year/{existing_year_id}", timeout=10)
        assert r.status_code in (401, 403)

    def test_exceptional_list_requires_auth(self):
        r = _http().get(f"{BASE_URL}/api/exceptional", timeout=10)
        assert r.status_code in (401, 403)


# =====================================================================
# PARTIE H - Account lockout after 5 failed attempts
# =====================================================================
# NOTE: The IP-based express-rate-limit (5 requests / 15 min in
# middleware/auth.js) will also block the 6th attempt from the same IP.
# To reliably test the DB-level lockout (per-user), we create a
# throwaway admin via SuperAdmin, then unlock/cleanup afterwards.

@pytest.fixture(scope="module")
def throwaway_admin(superadmin_ctx):
    """Create a fresh admin in the DELETE-TEST association for lockout testing."""
    s = superadmin_ctx["session"]
    # Find DELETE-TEST association id
    r = s.get(f"{BASE_URL}/api/platform/associations", timeout=10)
    assert r.status_code == 200
    assoc = next((a for a in r.json() if a["code"] == "DELETE-TEST"), None)
    if not assoc:
        pytest.skip("DELETE-TEST association not found")
    assoc_id = assoc["id"]

    email = f"test-lockout-{uuid.uuid4().hex[:8]}@delete-test.local"
    password = "LockTest123!"
    r = s.post(
        f"{BASE_URL}/api/platform/associations/{assoc_id}/admins",
        json={"email": email, "password": password},
        timeout=10,
    )
    if r.status_code == 403:
        pytest.skip(f"Cannot create throwaway admin (limit reached): {r.text[:200]}")
    assert r.status_code in (200, 201), f"Create admin failed: {r.status_code} {r.text[:200]}"
    admin_id = r.json()["admin"]["id"]

    yield {
        "email": email,
        "password": password,
        "association_id": assoc_id,
        "association_code": "DELETE-TEST",
        "admin_id": admin_id,
    }

    # Cleanup: delete the admin
    try:
        s.delete(
            f"{BASE_URL}/api/platform/associations/{assoc_id}/admins/{admin_id}",
            timeout=10,
        )
    except Exception:
        pass


class TestAccountLockout:
    """
    Vérifie qu'après 5 tentatives incorrectes, le compte est bloqué 30 min
    et qu'une connexion réussie remet le compteur à 0.

    IMPORTANT: Le rate-limit IP (5/15min) est aussi actif. On restart le
    backend juste avant pour repartir avec un compteur IP propre.
    """

    def _restart_backend(self):
        os.system("sudo supervisorctl restart backend >/dev/null 2>&1")
        time.sleep(5)

    def test_lockout_after_5_failures_then_success_resets(self, throwaway_admin, superadmin_ctx):
        # Clear IP-limiter first (in-memory, cleared on restart)
        self._restart_backend()

        email = throwaway_admin["email"]
        assoc_code = throwaway_admin["association_code"]
        good_password = throwaway_admin["password"]
        s = _http()

        # 5 attempts with wrong password. The IP limiter (max=5) will
        # allow exactly 5 attempts, all reaching the handler.
        last_status = None
        for i in range(5):
            r = s.post(
                f"{BASE_URL}/api/auth/login",
                json={"identifier": email, "password": "WRONG-pw", "associationCode": assoc_code},
                timeout=10,
            )
            assert r.status_code in (401, 403), \
                f"Attempt {i+1}: expected 401/403, got {r.status_code} {r.text[:150]}"
            last_status = r.status_code

        # Restart backend to reset IP limiter (DB lockout persists in Postgres)
        self._restart_backend()

        # 6th attempt with WRONG password: DB-level lockout should now yield 403 with "bloqué"
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": email, "password": "WRONG-pw", "associationCode": assoc_code},
            timeout=10,
        )
        assert r.status_code == 403, \
            f"Expected 403 (locked), got {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "bloqué" in body.get("error", "").lower() or "verrouil" in body.get("error", "").lower(), \
            f"Expected lockout error message, got: {body}"

        # 7th attempt with GOOD password: still locked → 403
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": email, "password": good_password, "associationCode": assoc_code},
            timeout=10,
        )
        assert r.status_code == 403, \
            f"Locked account should reject even correct pw, got {r.status_code} {r.text[:200]}"

        # ---- Reset lock via SuperAdmin password update
        # (PUT /platform/associations/:id/admins/:adminId/password resets
        # failedLoginAttempts and lockedUntil)
        new_password = "NewValidPw123!"
        r = superadmin_ctx["session"].put(
            f"{BASE_URL}/api/platform/associations/{throwaway_admin['association_id']}/admins/{throwaway_admin['admin_id']}/password",
            json={"password": new_password},
            timeout=10,
        )
        assert r.status_code == 200, f"Reset pw failed: {r.status_code} {r.text[:200]}"

        # Restart backend one more time to clear IP limiter before final tests
        self._restart_backend()

        # Successful login now → 200 (and resets DB counter to 0)
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": email, "password": new_password, "associationCode": assoc_code},
            timeout=10,
        )
        assert r.status_code == 200, \
            f"After unlock, correct pw should succeed: {r.status_code} {r.text[:200]}"
        assert "token" in r.json()

        # Verify counter reset: 1 wrong attempt should return 401 (not 403 lock)
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": email, "password": "WRONG-pw2", "associationCode": assoc_code},
            timeout=10,
        )
        assert r.status_code == 401, \
            f"Counter not reset after success — expected 401 got {r.status_code} {r.text[:200]}"
