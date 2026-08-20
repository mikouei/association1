"""
Tests: GET /api/members must expose approvalStatus so the web UI can display
'En attente de validation' for PENDING members instead of 'Actif'.

Bug context: Member.active defaults to true even when User.approvalStatus is
PENDING. The list endpoint must therefore return approvalStatus alongside
active so the front-end can compute the correct label.

Scope (backend only, per review_request):
- Admin ASCB (+2250708510832 / admin123) can list members and get 200.
- Each member has fields: id, name, active, phone, email, createdAt, approvalStatus.
- Seeded PENDING member ('Membre En Attente' / +2250700111222) has
  approvalStatus='PENDING' and active=true.
- Seeded APPROVED member ('Membre Note' / +2250700123456) has
  approvalStatus='APPROVED'.
- If either seeded member is missing, the test creates a PENDING one via the
  public join-request endpoint to still assert the shape.
- No REJECTED member is ever returned (rejects delete the account).
"""

import os
import time
import requests
import pytest

# Local backend (kotiz-backend) is on 8001 in this container.
BASE_URL = (os.environ.get("KOTIZ_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ASSOC_CODE = "ASCB"
ADMIN_PHONE = "+2250708510832"
ADMIN_PASSWORD = "admin123"

APPROVED_PHONE = "+2250700123456"   # 'Membre Note' seeded
PENDING_PHONE = "+2250700111222"    # 'Membre En Attente' seeded


def _unique_phone():
    return f"+22507{int(time.time() * 1000) % 10_000_000_000:010d}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOC_CODE},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "Missing token in admin login response"
    return tok


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def members_list(admin_token):
    """Fetch /api/members once and reuse across tests (idempotent GET)."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{API}/members", headers=headers, timeout=15)
    assert r.status_code == 200, f"GET /api/members failed: {r.status_code} {r.text}"
    data = r.json()
    assert isinstance(data, list), f"Expected list, got {type(data)}"
    return data


# -----------------------
# Endpoint sanity / shape
# -----------------------
class TestMembersListShape:
    """Non-regression: endpoint returns 200 with expected fields incl. approvalStatus."""

    REQUIRED_KEYS = {"id", "name", "active", "phone", "email", "createdAt", "approvalStatus"}

    def test_status_200_and_is_list(self, members_list):
        assert isinstance(members_list, list)

    def test_each_member_has_required_keys(self, members_list):
        # Skip cleanly if the association has no members yet (should not happen here).
        if not members_list:
            pytest.skip("No members returned; cannot validate shape")
        missing_report = []
        for m in members_list:
            missing = self.REQUIRED_KEYS - set(m.keys())
            if missing:
                missing_report.append({"id": m.get("id"), "missing": sorted(missing)})
        assert not missing_report, f"Members with missing keys: {missing_report}"

    def test_approval_status_values_are_valid(self, members_list):
        allowed = {"PENDING", "APPROVED"}
        invalid = [
            {"id": m.get("id"), "approvalStatus": m.get("approvalStatus")}
            for m in members_list
            if m.get("approvalStatus") not in allowed
        ]
        # REJECTED must NEVER appear in the list (users are deleted on reject).
        assert not invalid, f"Unexpected approvalStatus values: {invalid}"

    def test_no_mongodb_object_id_field(self, members_list):
        for m in members_list:
            assert "_id" not in m, f"Member contains raw _id: {m}"


# -----------------------
# Seeded PENDING member
# -----------------------
class TestPendingMemberVisible:
    def test_pending_member_present_with_active_true(self, admin_headers, members_list):
        pending = [m for m in members_list if m.get("phone") == PENDING_PHONE]

        # If the seed did not include the PENDING member (e.g. rate limit dropped it),
        # create one on the fly via the public endpoint to still exercise the shape.
        if not pending:
            phone = _unique_phone()
            r = requests.post(
                f"{API}/public/associations/{ASSOC_CODE}/join-request",
                json={"name": "TEST Pending Shape", "phone": phone, "password": "motdepasse123"},
                timeout=10,
            )
            assert r.status_code == 201, f"Could not create fallback PENDING: {r.status_code} {r.text}"
            # Re-fetch the list.
            r2 = requests.get(f"{API}/members", headers=admin_headers, timeout=10)
            assert r2.status_code == 200
            pending = [m for m in r2.json() if m.get("phone") == phone]

        assert len(pending) >= 1, "No PENDING member visible in /api/members"
        m = pending[0]
        assert m.get("approvalStatus") == "PENDING", (
            f"Expected approvalStatus=PENDING for {m.get('phone')}, got {m.get('approvalStatus')}"
        )
        # Bug root-cause validation: active=true while pending -> UI must rely on approvalStatus.
        assert m.get("active") is True, (
            f"Expected active=true for PENDING member (bug root cause), got {m.get('active')}"
        )
        assert m.get("name"), "PENDING member must expose 'name'"


# -----------------------
# Seeded APPROVED member
# -----------------------
class TestApprovedMemberVisible:
    def test_approved_member_present(self, members_list):
        approved = [m for m in members_list if m.get("phone") == APPROVED_PHONE]
        if not approved:
            # Fall back: at least one member must be APPROVED (the admin's member profile
            # if any, or others). Otherwise skip with a clear message.
            approved_any = [m for m in members_list if m.get("approvalStatus") == "APPROVED"]
            if not approved_any:
                pytest.skip("No APPROVED member in this environment to assert against")
            m = approved_any[0]
        else:
            m = approved[0]
        assert m.get("approvalStatus") == "APPROVED"
        assert m.get("active") is True


# -----------------------
# Access control (non-regression)
# -----------------------
class TestMembersListAccessControl:
    def test_requires_auth(self):
        r = requests.get(f"{API}/members", timeout=10)
        assert r.status_code in (401, 403)
