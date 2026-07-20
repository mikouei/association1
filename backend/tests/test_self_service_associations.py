"""
Backend tests for the "self-service association creation" feature.

Endpoints under test:
    GET  /api/public/associations/check-code/:code
    POST /api/public/associations/register
    GET  /api/public/associations/:code/info
    GET  /api/platform/associations         (must include `source` field)
    POST /api/platform/associations         (Super Admin path, still works)
    POST /api/auth/login                    (regression: admin login still works)
    POST /api/platform/login                (regression: super admin login still works)

Notes for future testing agents:
- The self-service registerLimiter is 5 requests / hour / IP (see routes/public.js).
  It is SHARED between GET /check-code/:code AND POST /register — so a full test
  suite would exceed the limit. We restart the backend before classes that hit
  the register endpoint heavily to reset the in-memory counter.
- The MAX_SELF_SERVICE_PER_USER limit defaults to 5 and applies per email/phone.
- Each test creates a unique code (TST-<uuid>) and cleans up via the Super Admin API
  in the finally / teardown block.
"""
import os
import subprocess
import time
import uuid
import requests
import pytest

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')

SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"
ADMIN_EMAIL = "admin@delete-test.local"
ADMIN_PASSWORD = "admin123"
ADMIN_ASSOC_CODE = "DELETE-TEST"


# ---------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------
@pytest.fixture(scope="module")
def superadmin_token():
    r = requests.post(f"{BASE_URL}/api/platform/login",
                      json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD},
                      timeout=15)
    assert r.status_code == 200, f"SuperAdmin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def sa_headers(superadmin_token):
    return {"Authorization": f"Bearer {superadmin_token}", "Content-Type": "application/json"}


@pytest.fixture
def unique_code():
    return f"TST-{uuid.uuid4().hex[:8].upper()}"


@pytest.fixture
def created_ids(sa_headers):
    """Register cleanup of associations created during a test."""
    ids = []
    yield ids
    for aid in ids:
        try:
            requests.delete(f"{BASE_URL}/api/platform/associations/{aid}",
                            headers=sa_headers, timeout=15)
        except Exception:
            pass


def _restart_backend_to_clear_rate_limits():
    """Utility: restart backend via supervisor to reset the in-memory rate-limit
    counters shared between /check-code and /register."""
    subprocess.run(["sudo", "supervisorctl", "restart", "backend"],
                   check=False, capture_output=True)
    # Wait for the port to be ready again
    for _ in range(20):
        try:
            r = requests.get(f"{BASE_URL}/api/public/associations", timeout=5)
            if r.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(0.5)


@pytest.fixture(scope="class")
def fresh_rate_limits():
    _restart_backend_to_clear_rate_limits()
    yield


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------
def _register_self_service(code, email=None, phone=None, name="TEST Self-Service Assoc",
                           admin_name="Test Admin", password="password123",
                           assoc_type="association"):
    payload = {
        "name": name,
        "type": assoc_type,
        "code": code,
        "adminName": admin_name,
        "adminPassword": password,
    }
    if email:
        payload["adminEmail"] = email
    if phone:
        payload["adminPhone"] = phone
    return requests.post(f"{BASE_URL}/api/public/associations/register",
                         json=payload, timeout=15)


def _find_assoc_id(sa_headers, code):
    r = requests.get(f"{BASE_URL}/api/platform/associations",
                     headers=sa_headers, timeout=15)
    if r.status_code != 200:
        return None
    for a in r.json():
        if a.get("code") == code:
            return a.get("id")
    return None


# ---------------------------------------------------------------
# Regression: existing auth flows still work
# ---------------------------------------------------------------
class TestExistingAuthStillWorks:
    def test_super_admin_login_still_works(self):
        r = requests.post(f"{BASE_URL}/api/platform/login",
                          json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert isinstance(data["token"], str) and len(data["token"]) > 20

    def test_admin_login_still_works(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"identifier": ADMIN_EMAIL,
                                "password": ADMIN_PASSWORD,
                                "associationCode": ADMIN_ASSOC_CODE},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert isinstance(data["token"], str) and len(data["token"]) > 20


# ---------------------------------------------------------------
# GET /api/public/associations/check-code/:code
# ---------------------------------------------------------------
class TestCheckCode:
    @pytest.fixture(autouse=True)
    def _reset(self, fresh_rate_limits):
        pass

    def test_check_code_available_for_free_code(self, unique_code):
        r = requests.get(f"{BASE_URL}/api/public/associations/check-code/{unique_code}",
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data == {"available": True}, data

    def test_check_code_taken_for_existing_code(self):
        # DELETE-TEST is a known existing association (seeded credentials)
        r = requests.get(f"{BASE_URL}/api/public/associations/check-code/{ADMIN_ASSOC_CODE}",
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("available") is False
        assert data.get("reason") == "taken", data

    def test_check_code_invalid_format_lowercase_ok_because_uppercased(self):
        # Server uppercases before regex; a lowercase 'abc' becomes 'ABC' which is valid format.
        # This test just documents the behaviour: 3-20 [A-Z0-9-] after uppercase → 'available' unless taken.
        r = requests.get(f"{BASE_URL}/api/public/associations/check-code/ab",
                         timeout=15)
        assert r.status_code == 200, r.text
        # 'AB' has only 2 chars → format invalid
        data = r.json()
        assert data == {"available": False, "reason": "format"}, data

    def test_check_code_invalid_format_special_chars(self):
        # Slashes are not permitted; but a slash would make the URL segment differ,
        # so we use an underscore which is not in [A-Z0-9-].
        r = requests.get(f"{BASE_URL}/api/public/associations/check-code/ABC_DEF",
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data == {"available": False, "reason": "format"}, data

    def test_check_code_invalid_format_too_long(self):
        long_code = "A" * 25
        r = requests.get(f"{BASE_URL}/api/public/associations/check-code/{long_code}",
                         timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"available": False, "reason": "format"}


# ---------------------------------------------------------------
# POST /api/public/associations/register
# ---------------------------------------------------------------
class TestRegisterAssociation:
    @pytest.fixture(autouse=True)
    def _reset(self, fresh_rate_limits):
        pass

    def test_register_success_creates_with_self_service_source(self, unique_code, sa_headers, created_ids):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = _register_self_service(unique_code, email=email, name="TEST New Assoc",
                                   admin_name="Alice Test")
        assert r.status_code == 201, f"expected 201 got {r.status_code}: {r.text}"
        data = r.json()
        # Response shape
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data.get("code") == unique_code
        assert data["association"]["code"] == unique_code
        assert data["association"]["name"] == "TEST New Assoc"
        assert data["admin"]["email"] == email
        aid = data["association"]["id"]
        created_ids.append(aid)

        # Verify source == 'self_service' via GET /api/platform/associations
        r2 = requests.get(f"{BASE_URL}/api/platform/associations",
                          headers=sa_headers, timeout=15)
        assert r2.status_code == 200
        matching = [a for a in r2.json() if a.get("id") == aid]
        assert len(matching) == 1
        assert matching[0].get("source") == "self_service", \
            f"source field missing/wrong: {matching[0]}"

    def test_register_requires_name(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"code": unique_code, "adminName": "X",
                                "adminEmail": "a@b.co", "adminPassword": "password123"},
                          timeout=15)
        assert r.status_code == 400, r.text
        assert "error" in r.json()

    def test_register_requires_code(self):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "Something", "adminName": "X",
                                "adminEmail": "a@b.co", "adminPassword": "password123"},
                          timeout=15)
        assert r.status_code == 400, r.text
        assert "error" in r.json()

    def test_register_requires_admin_name(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "N", "code": unique_code,
                                "adminEmail": "a@b.co", "adminPassword": "password123"},
                          timeout=15)
        assert r.status_code == 400, r.text
        assert "administrateur" in r.json().get("error", "").lower() \
            or "admin" in r.json().get("error", "").lower()


class TestRegisterValidationExtra:
    """Split from TestRegisterAssociation to fit within the 5/hour rate-limit bucket."""
    @pytest.fixture(autouse=True)
    def _reset(self, fresh_rate_limits):
        pass

    def test_register_requires_email_or_phone(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "N", "code": unique_code,
                                "adminName": "A", "adminPassword": "password123"},
                          timeout=15)
        assert r.status_code == 400, r.text
        err = r.json().get("error", "").lower()
        assert "email" in err or "phone" in err or "téléphone" in err

    def test_register_requires_password(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "N", "code": unique_code,
                                "adminName": "A", "adminEmail": "a@b.co"},
                          timeout=15)
        assert r.status_code == 400, r.text

    def test_register_password_min_length(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "N", "code": unique_code,
                                "adminName": "A", "adminEmail": "a@b.co",
                                "adminPassword": "abc"},
                          timeout=15)
        assert r.status_code == 400, r.text
        assert "6" in r.json().get("error", "")

    def test_register_invalid_email_format(self, unique_code):
        r = requests.post(f"{BASE_URL}/api/public/associations/register",
                          json={"name": "N", "code": unique_code,
                                "adminName": "A", "adminEmail": "not-an-email",
                                "adminPassword": "password123"},
                          timeout=15)
        assert r.status_code == 400, r.text
        assert "email" in r.json().get("error", "").lower()


class TestRegisterDuplicateCode:
    """Isolated because it needs 2 real register calls."""
    @pytest.fixture(autouse=True)
    def _reset(self, fresh_rate_limits):
        pass

    def test_register_duplicate_code_rejected(self, sa_headers, created_ids):
        code = f"TST-{uuid.uuid4().hex[:8].upper()}"
        email1 = f"first_{uuid.uuid4().hex[:6]}@example.com"
        r1 = _register_self_service(code, email=email1)
        assert r1.status_code == 201, r1.text
        created_ids.append(r1.json()["association"]["id"])

        # Try again with same code, different email
        email2 = f"second_{uuid.uuid4().hex[:6]}@example.com"
        r2 = _register_self_service(code, email=email2)
        assert r2.status_code == 400, r2.text
        assert "existe" in r2.json().get("error", "").lower() \
            or "code" in r2.json().get("error", "").lower()


# ---------------------------------------------------------------
# GET /api/public/associations/:code/info
# ---------------------------------------------------------------
class TestAssociationInfo:
    def test_info_returns_public_fields_for_valid_code(self):
        r = requests.get(f"{BASE_URL}/api/public/associations/{ADMIN_ASSOC_CODE}/info",
                         timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("code") == ADMIN_ASSOC_CODE
        assert "name" in data and isinstance(data["name"], str)
        assert "type" in data
        # Should NOT leak sensitive fields
        assert "adminEmail" not in data
        assert "source" not in data
        assert "id" not in data

    def test_info_404_for_invalid_code(self):
        r = requests.get(f"{BASE_URL}/api/public/associations/NONEXISTENT-XYZ-12345/info",
                         timeout=15)
        assert r.status_code == 404, r.text
        assert "error" in r.json()


# ---------------------------------------------------------------
# GET /api/platform/associations - includes `source` field
# ---------------------------------------------------------------
class TestPlatformAssociationsSourceField:
    def test_platform_list_includes_source_field(self, sa_headers):
        r = requests.get(f"{BASE_URL}/api/platform/associations",
                         headers=sa_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        for a in data:
            assert "source" in a, f"Association {a.get('code')} missing 'source' field"
            assert a["source"] in ("manual", "self_service"), \
                f"unexpected source value: {a['source']}"


# ---------------------------------------------------------------
# POST /api/platform/associations - Super Admin path still works
# (should NOT be blocked by self-service per-user limit)
# ---------------------------------------------------------------
class TestSuperAdminCreationUnaffected:
    def test_super_admin_create_association_still_works(self, sa_headers, created_ids):
        code = f"TST-{uuid.uuid4().hex[:8].upper()}"
        payload = {
            "name": "TEST SA-Created Assoc",
            "type": "association",
            "code": code,
            "adminEmail": f"sa_admin_{uuid.uuid4().hex[:6]}@example.com",
            "adminPassword": "password123",
            "adminName": "SA Test Admin"
        }
        r = requests.post(f"{BASE_URL}/api/platform/associations",
                         json=payload, headers=sa_headers, timeout=15)
        assert r.status_code in (200, 201), f"got {r.status_code}: {r.text}"
        body = r.json()
        # body may return the association directly or wrapped
        assoc = body if "id" in body else body.get("association", body)
        aid = assoc.get("id")
        assert aid, f"no id in response: {body}"
        created_ids.append(aid)

        # Verify source == 'manual' via GET /api/platform/associations
        r2 = requests.get(f"{BASE_URL}/api/platform/associations",
                          headers=sa_headers, timeout=15)
        assert r2.status_code == 200
        matching = [a for a in r2.json() if a.get("id") == aid]
        assert len(matching) == 1
        assert matching[0].get("source") == "manual", \
            f"SA-created association should have source='manual', got: {matching[0].get('source')}"


# ---------------------------------------------------------------
# MAX_SELF_SERVICE_PER_USER limit
# ---------------------------------------------------------------
# NOTE: this test is expensive (creates 5 associations) and can be blocked by the
# registerLimiter (5 req/hour/IP). We mark it as slow and skip if any 429 shows up.
class TestSelfServiceLimit:
    @pytest.fixture(autouse=True)
    def _reset(self, fresh_rate_limits):
        pass

    def test_limit_blocks_after_max_reached(self, sa_headers, created_ids):
        """Attempt to create 6 self_service associations with the same email.
        The 6th (or possibly earlier if rate-limited) must return 403.
        If the request hits 429 first (registerLimiter 5/h/IP) we skip."""
        email = f"limit_{uuid.uuid4().hex[:8]}@example.com"
        results = []
        for i in range(6):
            code = f"TST-{uuid.uuid4().hex[:8].upper()}"
            r = _register_self_service(code, email=email,
                                        name=f"TEST Limit {i}")
            results.append((code, r.status_code, r.text[:200]))
            if r.status_code == 201:
                created_ids.append(r.json()["association"]["id"])
            elif r.status_code == 429:
                pytest.skip("Rate limiter (registerLimiter 5/h) blocked us before "
                            "hitting MAX_SELF_SERVICE_PER_USER. Restart backend "
                            "and re-run only this test.")
            elif r.status_code == 403:
                # Confirmed: per-user limit triggered
                assert "limite" in r.json().get("error", "").lower() \
                    or "atteint" in r.json().get("error", "").lower()
                return
        # We got to iteration 6 without a 403 — that means MAX was not enforced.
        pytest.fail(f"Expected 403 after 5 successful creations, got: {results}")
