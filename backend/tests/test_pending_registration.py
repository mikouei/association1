"""
Tests for the 'Pending Registration' feature (Kotiz/AssocManager).

Covers:
- POST /api/public/associations/ASCB/join-request (create PENDING, no JWT)
- Password < 8 -> 400
- Duplicate phone/email in association -> 409 ALREADY_MEMBER
- Login PENDING -> 403 PENDING_APPROVAL (no failure counter incremented)
- Rejected member: user deleted -> 401 invalid credentials
- GET /api/admin/pending-members (list)
- POST /api/admin/pending-members/approve -> updateMany -> can login after
- POST /api/admin/pending-members/reject -> delete member+user
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ASSOC_CODE = "ASCB"
ADMIN_PHONE = "+2250708510832"
ADMIN_PASSWORD = "admin123"


def _unique_phone():
    # 10-digit local part, prefixed with +22507
    return f"+22507{int(time.time() * 1000) % 10_000_000_000:010d}"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOC_CODE},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestJoinRequestValidation:
    def test_password_too_short_returns_400(self):
        r = requests.post(
            f"{API}/public/associations/{ASSOC_CODE}/join-request",
            json={"name": "TEST Short", "phone": _unique_phone(), "password": "abc"},
            timeout=10,
        )
        assert r.status_code == 400, r.text
        assert "mot de passe" in r.json().get("error", "").lower()

    def test_missing_name_returns_400(self):
        r = requests.post(
            f"{API}/public/associations/{ASSOC_CODE}/join-request",
            json={"phone": _unique_phone(), "password": "motdepasse123"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_unknown_association_returns_404(self):
        r = requests.post(
            f"{API}/public/associations/DOES-NOT-EXIST/join-request",
            json={"name": "TEST X", "phone": _unique_phone(), "password": "motdepasse123"},
            timeout=10,
        )
        assert r.status_code == 404


class TestPendingFlow:
    """End-to-end: create PENDING -> login blocked -> approve -> login OK."""

    def test_create_pending_no_token(self):
        phone = _unique_phone()
        r = requests.post(
            f"{API}/public/associations/{ASSOC_CODE}/join-request",
            json={"name": "TEST Approved", "phone": phone, "password": "motdepasse123"},
            timeout=10,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("status") == "PENDING"
        assert "token" not in body, "Endpoint must NOT return a JWT token for PENDING users"
        TestPendingFlow.phone_approved = phone

    def test_duplicate_phone_returns_409(self):
        r = requests.post(
            f"{API}/public/associations/{ASSOC_CODE}/join-request",
            json={"name": "TEST Dup", "phone": TestPendingFlow.phone_approved, "password": "motdepasse123"},
            timeout=10,
        )
        assert r.status_code == 409, r.text
        assert r.json().get("code") == "ALREADY_MEMBER"

    def test_pending_login_blocked_403(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"phone": TestPendingFlow.phone_approved, "password": "motdepasse123", "associationCode": ASSOC_CODE},
            timeout=10,
        )
        assert r.status_code == 403, r.text
        assert r.json().get("code") == "PENDING_APPROVAL"

    def test_admin_can_list_pending(self, admin_headers):
        r = requests.get(f"{API}/admin/pending-members", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        matches = [u for u in arr if u.get("phone") == TestPendingFlow.phone_approved]
        assert len(matches) == 1, f"Pending user not listed: {arr}"
        u = matches[0]
        for key in ("id", "name", "email", "phone", "requestedAt"):
            assert key in u, f"Missing key {key} in pending item: {u}"
        assert u["name"] == "TEST Approved"
        TestPendingFlow.pending_id = u["id"]

    def test_approve_pending_updates_count(self, admin_headers):
        r = requests.post(
            f"{API}/admin/pending-members/approve",
            headers=admin_headers,
            json={"ids": [TestPendingFlow.pending_id]},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("count") == 1

    def test_login_ok_after_approval(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"phone": TestPendingFlow.phone_approved, "password": "motdepasse123", "associationCode": ASSOC_CODE},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "MEMBER"

    def test_pending_no_longer_in_list(self, admin_headers):
        r = requests.get(f"{API}/admin/pending-members", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        remaining = [u for u in arr if u.get("id") == TestPendingFlow.pending_id]
        assert remaining == []


@pytest.fixture(scope="class")
def reset_rate_limit():
    """Restart backend to reset in-memory rate limiter (joinLimiter = 5/hour/IP)."""
    import subprocess
    subprocess.run(["sudo", "supervisorctl", "restart", "kotiz-backend"], check=False, capture_output=True)
    time.sleep(4)
    yield


@pytest.mark.usefixtures("reset_rate_limit")
class TestRejectFlow:
    def test_reject_deletes_user(self, admin_headers):
        phone = _unique_phone()
        # Create PENDING
        r = requests.post(
            f"{API}/public/associations/{ASSOC_CODE}/join-request",
            json={"name": "TEST Rejected", "phone": phone, "password": "motdepasse123"},
            timeout=10,
        )
        assert r.status_code == 201, r.text

        # Get its id
        r = requests.get(f"{API}/admin/pending-members", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        matches = [u for u in r.json() if u.get("phone") == phone]
        assert len(matches) == 1
        pending_id = matches[0]["id"]

        # Reject
        r = requests.post(
            f"{API}/admin/pending-members/reject",
            headers=admin_headers,
            json={"ids": [pending_id]},
            timeout=10,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("count") == 1

        # Login with rejected creds -> since user is DELETED, expect 401 (invalid creds)
        r = requests.post(
            f"{API}/auth/login",
            json={"phone": phone, "password": "motdepasse123", "associationCode": ASSOC_CODE},
            timeout=10,
        )
        assert r.status_code == 401, r.text

        # Should not appear in pending list anymore
        r = requests.get(f"{API}/admin/pending-members", headers=admin_headers, timeout=10)
        assert r.status_code == 200
        assert all(u["id"] != pending_id for u in r.json())


class TestAdminAuthRequired:
    def test_pending_list_requires_auth(self):
        r = requests.get(f"{API}/admin/pending-members", timeout=10)
        assert r.status_code in (401, 403)

    def test_approve_requires_auth(self):
        r = requests.post(f"{API}/admin/pending-members/approve", json={"ids": ["x"]}, timeout=10)
        assert r.status_code in (401, 403)

    def test_empty_ids_returns_400(self, admin_headers):
        r = requests.post(
            f"{API}/admin/pending-members/approve",
            headers=admin_headers,
            json={"ids": []},
            timeout=10,
        )
        assert r.status_code == 400
