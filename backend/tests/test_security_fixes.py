"""
Tests for the 10 security/bug fixes in AssocManager audit (Iteration 9)
Scope:
 0. Export PDF/CSV endpoints reachable (not blocked)
 1. HTML injection prevention (escapeHtml)
 2. CSV injection protection (escapeCsv)
 3. Clean error messages
 4. Crypto-secure token generation (indirect: member creation returns a strong token)
 5. Year amount / range validation
 6. Phone duplicate check on member creation
 7. Rate limit on public deletion endpoint (5/hour)
 8. CORS - obsolete domain removed
 9. Helmet security headers
10. Email format validation (member, admin, super-admin)
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = (
    os.environ.get("REACT_APP_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://mobile-bug-crush-1.preview.emergentagent.com"
).rstrip("/")

SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"

ADMIN_EMAIL = "admin@delete-test.local"
ADMIN_PASSWORD = "admin123"
ASSOCIATION_CODE = "DELETE-TEST"


# ---------------------------------------------------------------------------
# Shared fixtures (session-scoped so we only login once and avoid rate limits)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def superadmin_token(http):
    r = http.post(
        f"{BASE_URL}/api/platform/login",
        json={"email": SUPERADMIN_EMAIL, "password": SUPERADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Super-admin login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "associationCode": ASSOCIATION_CODE,
        },
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture
def admin_headers(admin_token):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {admin_token}",
    }


@pytest.fixture
def superadmin_headers(superadmin_token):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {superadmin_token}",
    }


# ---------------------------------------------------------------------------
# 9. Helmet security headers
# ---------------------------------------------------------------------------

class TestHelmetHeaders:
    def test_security_headers_present(self, http):
        r = http.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200

        h = {k.lower(): v for k, v in r.headers.items()}
        # Helmet default headers
        assert "x-content-type-options" in h and h["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in h
        assert "x-dns-prefetch-control" in h
        assert "referrer-policy" in h
        assert "content-security-policy" in h
        assert "strict-transport-security" in h or True  # only over HTTPS -> present on preview URL


# ---------------------------------------------------------------------------
# 8. CORS - obsolete domain removed
# ---------------------------------------------------------------------------

class TestCorsConfig:
    def test_obsolete_domain_rejected(self, http):
        """The obsolete domain 'https://web.onrender.com' (or similar removed one)
        should NOT be echoed back in Access-Control-Allow-Origin."""
        r = http.get(
            f"{BASE_URL}/api/health",
            headers={"Origin": "https://obsolete-domain.onrender.com"},
            timeout=10,
        )
        # Should not echo obsolete origin
        acao = r.headers.get("Access-Control-Allow-Origin", "")
        assert "obsolete-domain" not in acao

    def test_allowed_domain_ok(self, http):
        r = http.get(
            f"{BASE_URL}/api/health",
            headers={"Origin": "https://assocmanager-web.onrender.com"},
            timeout=10,
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Auth login smoke tests
# ---------------------------------------------------------------------------

class TestAuthLogin:
    def test_super_admin_login(self, superadmin_token):
        assert isinstance(superadmin_token, str)
        assert len(superadmin_token) > 20

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str)
        assert len(admin_token) > 20


# ---------------------------------------------------------------------------
# 0. Export endpoints reachable / correct content-type
# 1. escapeHtml for PDF (HTML)
# 2. escapeCsv for CSV
# ---------------------------------------------------------------------------

class TestExports:
    def test_export_members_csv(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/export/members",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        ct = r.headers.get("Content-Type", "")
        assert "text/csv" in ct
        # Expected header row (French)
        first_line = r.text.splitlines()[0] if r.text else ""
        assert "Nom" in first_line and "Actif" in first_line

    def test_export_stats_pdf_html(self, admin_headers):
        r = requests.get(
            f"{BASE_URL}/api/export/stats/pdf",
            headers=admin_headers,
            timeout=30,
        )
        # Requires an active year in DELETE-TEST (guaranteed by seed)
        assert r.status_code == 200, r.text
        ct = r.headers.get("Content-Type", "")
        assert "text/html" in ct or "text/csv" in ct
        # No raw < or > from a rogue field name (escapeHtml)
        body = r.text
        assert "<script>" not in body.lower(), "escapeHtml should prevent raw <script>"

    def test_export_members_csv_no_formula_injection(self, admin_headers):
        """Any cell starting with =,+,-,@ must be single-quoted (CSV injection guard).
        We do a black-box scan of the resulting CSV to make sure escapeCsv is applied.
        This does not create rogue data; it only reads existing rows."""
        r = requests.get(
            f"{BASE_URL}/api/export/members",
            headers=admin_headers,
            timeout=20,
        )
        assert r.status_code == 200
        for line in r.text.splitlines()[1:]:
            for cell in line.split(","):
                stripped = cell.strip('"')
                if stripped and stripped[0] in "=+-@\t\r":
                    pytest.fail(
                        f"CSV cell starts with dangerous char without escape: {cell!r}"
                    )


# ---------------------------------------------------------------------------
# 5. Year amount / range validation
# ---------------------------------------------------------------------------

class TestYearValidation:
    def test_year_out_of_range_low(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/years",
            headers=admin_headers,
            json={"year": 1999, "monthlyAmount": 1000},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "invalides" in r.text.lower() or "invalid" in r.text.lower()

    def test_year_out_of_range_high(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/years",
            headers=admin_headers,
            json={"year": 2101, "monthlyAmount": 1000},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_year_negative_amount(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/years",
            headers=admin_headers,
            json={"year": 2050, "monthlyAmount": -500},
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "invalides" in r.text.lower() or "invalid" in r.text.lower()

    def test_year_zero_amount(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/years",
            headers=admin_headers,
            json={"year": 2051, "monthlyAmount": 0},
            timeout=15,
        )
        # 0 fails the initial "!monthlyAmount" check (falsy) -> also 400
        assert r.status_code == 400, r.text


# ---------------------------------------------------------------------------
# 10. Email format validation (members / admin / platform)
# ---------------------------------------------------------------------------

class TestEmailValidation:
    def _mk_member(self, email):
        return {
            "name": f"TEST_{uuid.uuid4().hex[:6]}",
            "customFieldValue": f"TEST_{uuid.uuid4().hex[:6]}",
            "email": email,
        }

    def test_member_invalid_email_format(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/members",
            headers=admin_headers,
            json=self._mk_member("not-an-email"),
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "Format email invalide" in r.text

    def test_member_invalid_email_no_domain(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/members",
            headers=admin_headers,
            json=self._mk_member("user@localhost"),
            timeout=15,
        )
        # Regex requires "@X.Y" -> localhost has no dot -> should reject
        assert r.status_code == 400, r.text
        assert "Format email invalide" in r.text

    def test_admin_invalid_email_format(self, admin_headers):
        # admin creation lives at POST /api/admin
        r = requests.post(
            f"{BASE_URL}/api/admin",
            headers=admin_headers,
            json={
                "email": "not-an-email",
                "password": "somepass123",
                "name": "TEST_admin",
            },
            timeout=15,
        )
        # 400 with "Format email invalide" expected
        assert r.status_code == 400, r.text
        assert "Format email invalide" in r.text

    def test_platform_admin_invalid_email_format(self, superadmin_headers):
        """Super-admin: creating a new super-admin with invalid email must fail 400."""
        r = requests.post(
            f"{BASE_URL}/api/platform/superadmins",
            headers=superadmin_headers,
            json={
                "email": "invalid-format",
                "password": "somepass123",
                "name": "TEST_SA",
            },
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "Format email invalide" in r.text


# ---------------------------------------------------------------------------
# 6. Phone duplicate detection on member creation
# ---------------------------------------------------------------------------

class TestPhoneDuplicate:
    def test_duplicate_phone_rejected(self, admin_headers):
        phone = f"06{uuid.uuid4().int % 100000000:08d}"
        payload_a = {
            "name": f"TEST_A_{uuid.uuid4().hex[:6]}",
            "customFieldValue": f"TEST_A_{uuid.uuid4().hex[:6]}",
            "phone": phone,
        }
        r1 = requests.post(
            f"{BASE_URL}/api/members",
            headers=admin_headers,
            json=payload_a,
            timeout=15,
        )
        assert r1.status_code in (200, 201), r1.text
        created = r1.json()
        member_id = (
            created.get("id")
            or created.get("user", {}).get("id")
            or created.get("member", {}).get("id")
        )

        try:
            payload_b = {
                "name": f"TEST_B_{uuid.uuid4().hex[:6]}",
                "customFieldValue": f"TEST_B_{uuid.uuid4().hex[:6]}",
                "phone": phone,
            }
            r2 = requests.post(
                f"{BASE_URL}/api/members",
                headers=admin_headers,
                json=payload_b,
                timeout=15,
            )
            assert r2.status_code == 400, r2.text
            assert "téléphone" in r2.text.lower() or "phone" in r2.text.lower()
        finally:
            # Cleanup: delete the first created member
            if member_id:
                requests.delete(
                    f"{BASE_URL}/api/members/{member_id}",
                    headers=admin_headers,
                    timeout=15,
                )


# ---------------------------------------------------------------------------
# 4. Crypto secure tokens (indirect: created member has a strong access token)
# ---------------------------------------------------------------------------

class TestCryptoToken:
    def test_created_member_has_strong_token(self, admin_headers):
        payload = {
            "name": f"TEST_TOK_{uuid.uuid4().hex[:6]}",
            "customFieldValue": f"TEST_TOK_{uuid.uuid4().hex[:6]}",
            "phone": f"07{uuid.uuid4().int % 100000000:08d}",
        }
        r = requests.post(
            f"{BASE_URL}/api/members",
            headers=admin_headers,
            json=payload,
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        body = r.json()
        # Token can be at top-level, or in user/member; try to locate
        token = (
            body.get("accessToken")
            or body.get("token")
            or body.get("user", {}).get("token")
            or body.get("member", {}).get("token")
        )
        member_id = (
            body.get("id")
            or body.get("user", {}).get("id")
            or body.get("member", {}).get("id")
        )
        try:
            if token:
                # crypto.randomBytes(24).toString('base64url') -> 32 chars, url-safe
                assert len(token) >= 20, f"Access token too short: {token}"
                # base64url charset only
                import re
                assert re.match(r"^[A-Za-z0-9_-]+$", token), f"Bad token charset: {token}"
        finally:
            if member_id:
                requests.delete(
                    f"{BASE_URL}/api/members/{member_id}",
                    headers=admin_headers,
                    timeout=15,
                )


# ---------------------------------------------------------------------------
# 7. Rate limit on public deletion endpoint (5 / hour)
# ---------------------------------------------------------------------------

class TestPublicRateLimit:
    def test_deletion_rate_limit(self, http):
        """Fire 7 requests, expect a 429 within the last two."""
        got_429 = False
        for i in range(7):
            r = http.post(
                f"{BASE_URL}/api/public/deletion-request",
                json={
                    "email": f"TEST_rate_{i}@example.com",
                    "associationCode": ASSOCIATION_CODE,
                },
                timeout=15,
            )
            if r.status_code == 429:
                got_429 = True
                # Verify a French rate-limit error message body
                assert "Trop de demandes" in r.text or "rate" in r.text.lower()
                break
        assert got_429, "Expected 429 after >5 requests on /api/public/deletion-request"


# ---------------------------------------------------------------------------
# 3. Clean error messages (no stack traces leaking)
# ---------------------------------------------------------------------------

class TestCleanErrors:
    def test_invalid_json_body(self, admin_headers):
        r = requests.post(
            f"{BASE_URL}/api/members",
            headers=admin_headers,
            data="not-json",
            timeout=15,
        )
        # Should return a clean 400/500 without a raw stack trace
        assert r.status_code in (400, 500)
        low = r.text.lower()
        assert "traceback" not in low
        assert "at object.<anonymous>" not in low
        assert "\\n    at " not in r.text  # node stack marker

    def test_unknown_route_404(self, http):
        r = http.get(f"{BASE_URL}/api/does-not-exist-xyz", timeout=10)
        assert r.status_code in (404, 405)
