"""
Regression tests for the new Super Admin management endpoints
Feature scope:
    - GET    /api/platform/superadmins   → liste des Super Admins
    - POST   /api/platform/superadmins   → créer un nouveau Super Admin
    - DELETE /api/platform/superadmins/:id → supprimer (empêche last / self)

NB: Ces tests nécessitent que la DB Postgres soit accessible.
"""
import os
import pytest
import uuid

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')


# ─── Auth Fixture ─────────────────────────────────────────────────────────────

class TestSuperAdminsList:
    """GET /api/platform/superadmins"""

    def test_list_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/platform/superadmins")
        assert r.status_code == 401

    def test_list_returns_array(self, superadmin_client):
        r = superadmin_client.get(f"{BASE_URL}/api/platform/superadmins")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # Must contain at least the default drigo@drigo.local
        emails = [sa.get("email") for sa in data]
        assert "drigo@drigo.local" in emails
        # Verify shape (no passwordHash leaked)
        for sa in data:
            assert set(sa.keys()) >= {"id", "email", "name", "active", "createdAt"}
            assert "passwordHash" not in sa
            assert "password" not in sa


class TestSuperAdminsCreate:
    """POST /api/platform/superadmins"""

    def test_create_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": "unauth@test.local", "password": "test1234"
        })
        assert r.status_code == 401

    def test_create_missing_fields(self, superadmin_client):
        r = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={})
        assert r.status_code == 400
        assert "requis" in r.json().get("error", "").lower()

    def test_create_password_too_short(self, superadmin_client):
        r = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": f"TEST_short_{uuid.uuid4().hex[:6]}@test.local",
            "password": "abc"
        })
        assert r.status_code == 400

    def test_create_success_and_list_reflects(self, superadmin_client):
        email = f"TEST_sa_{uuid.uuid4().hex[:8]}@test.local"
        r = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": email,
            "password": "supersecret",
            "name": "TEST Super Admin"
        })
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["email"] == email
        assert created["name"] == "TEST Super Admin"
        assert created["active"] is True
        assert "id" in created
        assert "passwordHash" not in created

        created_id = created["id"]

        # Verify persisted (GET list should include it)
        r2 = superadmin_client.get(f"{BASE_URL}/api/platform/superadmins")
        assert r2.status_code == 200
        assert any(sa["id"] == created_id for sa in r2.json())

        # Cleanup: delete the newly created one
        r3 = superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{created_id}")
        assert r3.status_code == 200

    def test_create_duplicate_email_rejected(self, superadmin_client):
        r = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": "drigo@drigo.local",
            "password": "whatever"
        })
        assert r.status_code == 400
        assert "existe" in r.json().get("error", "").lower()


class TestSuperAdminsDelete:
    """DELETE /api/platform/superadmins/:id"""

    def test_delete_requires_auth(self, api_client):
        r = api_client.delete(f"{BASE_URL}/api/platform/superadmins/some-id")
        assert r.status_code == 401

    def test_delete_cannot_delete_self(self, superadmin_client):
        # Get current SA id via /me
        me = superadmin_client.get(f"{BASE_URL}/api/platform/me")
        assert me.status_code == 200
        my_id = me.json()["id"]

        # Need at least 2 SA so we don't hit the "last SA" guard first.
        # Create a temp one to satisfy the count>1 precondition.
        tmp_email = f"TEST_selfdel_{uuid.uuid4().hex[:8]}@test.local"
        tmp = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": tmp_email, "password": "temp1234"
        })
        assert tmp.status_code == 201
        tmp_id = tmp.json()["id"]

        try:
            # Try to delete self → must be 400
            r = superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{my_id}")
            assert r.status_code == 400
            err = r.json().get("error", "").lower()
            assert "propre" in err or "cannot" in err or "vous" in err
        finally:
            # Cleanup the temp SA
            superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{tmp_id}")

    def test_delete_nonexistent_returns_404(self, superadmin_client):
        # First ensure we have >1 SA so we pass the "last SA" check
        tmp_email = f"TEST_dummy_{uuid.uuid4().hex[:8]}@test.local"
        tmp = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": tmp_email, "password": "temp1234"
        })
        assert tmp.status_code == 201
        tmp_id = tmp.json()["id"]

        try:
            r = superadmin_client.delete(
                f"{BASE_URL}/api/platform/superadmins/nonexistent-id-xyz"
            )
            # Route checks "last SA" first (count<=1). Since we have >1, then existence check → 404
            assert r.status_code == 404
        finally:
            superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{tmp_id}")

    def test_delete_last_superadmin_blocked(self, superadmin_client):
        """
        Ensures the guard 'Impossible de supprimer le dernier Super Admin' works.
        We first make sure only 1 SA remains, then try to delete an id → 400.
        NOTE: This test is only meaningful when the DB has exactly 1 SA.
        We simulate by counting: if >1, we skip.
        """
        r = superadmin_client.get(f"{BASE_URL}/api/platform/superadmins")
        assert r.status_code == 200
        actives = [sa for sa in r.json() if sa.get("active")]
        if len(actives) != 1:
            pytest.skip(f"Cannot test 'last SA' guard: {len(actives)} active SAs")
        sole_id = actives[0]["id"]
        resp = superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{sole_id}")
        assert resp.status_code == 400
        assert "dernier" in resp.json().get("error", "").lower()


class TestNewSuperAdminCanLogin:
    """End-to-end : créer un SA → login avec ses creds → cleanup"""

    def test_created_superadmin_can_login(self, api_client, superadmin_client):
        email = f"TEST_login_{uuid.uuid4().hex[:8]}@test.local"
        password = "logintest123"
        r = superadmin_client.post(f"{BASE_URL}/api/platform/superadmins", json={
            "email": email, "password": password, "name": "Login Test"
        })
        assert r.status_code == 201
        new_id = r.json()["id"]

        try:
            # Login with new SA (use a fresh session to avoid auth header collision)
            import requests
            fresh = requests.Session()
            login = fresh.post(f"{BASE_URL}/api/platform/login", json={
                "email": email, "password": password
            })
            assert login.status_code == 200, login.text
            body = login.json()
            assert "token" in body
            assert body["user"]["email"] == email
            assert body["user"]["role"] == "SUPER_ADMIN"
        finally:
            superadmin_client.delete(f"{BASE_URL}/api/platform/superadmins/{new_id}")
