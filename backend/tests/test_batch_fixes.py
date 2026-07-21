"""
Backend tests for batch fixes:
- B) Erreurs silencieuses membre (duplicate phone/email)
- C) Admin can become member (GET /admin/list returns member, POST /members/link-admin)
- E) Password validation (min 8 chars for member and admin)
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')

DELETE_TEST_ADMIN_EMAIL = "admin@delete-test.local"
DELETE_TEST_ADMIN_PASSWORD = "admin123"
DELETE_TEST_ASSOCIATION_CODE = "DELETE-TEST"


# ---- Fixtures ----

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_auth(api_client):
    """Login as admin@delete-test.local"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": DELETE_TEST_ADMIN_EMAIL,
        "password": DELETE_TEST_ADMIN_PASSWORD,
        "associationCode": DELETE_TEST_ASSOCIATION_CODE,
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} {response.text}")
    data = response.json()
    return {
        "token": data["token"],
        "user_id": data["user"]["id"],
        "association_id": data["association"]["id"],
    }


@pytest.fixture(scope="module")
def admin_client(api_client, admin_auth):
    api_client.headers.update({"Authorization": f"Bearer {admin_auth['token']}"})
    return api_client


@pytest.fixture(scope="module")
def unique_suffix():
    return f"{uuid.uuid4().hex[:8]}_{int(time.time())}"


# ---- Test: Login works ----

class TestLogin:
    """Ensure admin login flow remains functional"""

    def test_login_success(self, admin_auth):
        assert admin_auth["token"]
        assert admin_auth["user_id"]
        assert admin_auth["association_id"]


# ---- Part B: Duplicate phone/email returns explicit error ----

class TestDuplicatePhoneEmail:
    """Part B - Backend must return 400 with error message on duplicate phone/email"""

    def test_duplicate_phone_returns_400(self, admin_client, unique_suffix):
        phone = f"77{unique_suffix[:8]}"
        # Create first member
        r1 = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_MemberB1_{unique_suffix}",
            "customFieldValue": f"CF-{unique_suffix}",
            "phone": phone,
            "password": "password123",
        })
        assert r1.status_code == 201, f"First create failed: {r1.text}"
        # Try creating another member with same phone
        r2 = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_MemberB2_{unique_suffix}",
            "customFieldValue": f"CF2-{unique_suffix}",
            "phone": phone,
            "password": "password123",
        })
        assert r2.status_code == 400, f"Expected 400 on duplicate phone, got {r2.status_code}: {r2.text}"
        body = r2.json()
        assert "error" in body
        assert "téléphone" in body["error"].lower() or "phone" in body["error"].lower()

        # Cleanup created member
        try:
            admin_client.delete(f"{BASE_URL}/api/members/{r1.json()['id']}")
        except Exception:
            pass

    def test_duplicate_email_returns_400(self, admin_client, unique_suffix):
        email = f"test_dup_{unique_suffix}@example.com"
        r1 = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_MemberE1_{unique_suffix}",
            "customFieldValue": f"CFE-{unique_suffix}",
            "email": email,
            "password": "password123",
        })
        assert r1.status_code == 201, f"First create failed: {r1.text}"
        r2 = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_MemberE2_{unique_suffix}",
            "customFieldValue": f"CFE2-{unique_suffix}",
            "email": email,
            "password": "password123",
        })
        assert r2.status_code == 400
        body = r2.json()
        assert "error" in body
        assert "email" in body["error"].lower()

        # Cleanup
        try:
            admin_client.delete(f"{BASE_URL}/api/members/{r1.json()['id']}")
        except Exception:
            pass


# ---- Part C: Admin becoming member ----

class TestAdminAsMember:
    """Part C - GET /admin/list includes member field; POST /members/link-admin creates member profile for admin"""

    def test_admin_list_returns_member_field(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/list")
        assert r.status_code == 200, f"admin/list failed: {r.text}"
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for admin in data:
            assert "member" in admin, f"'member' key missing in admin entry: {admin}"
            # member is either null or an object with id
            if admin["member"] is not None:
                assert "id" in admin["member"]

    def test_link_admin_creates_member_profile(self, admin_client, unique_suffix):
        # 1. Create a new admin (not linked to a member)
        new_admin_email = f"test_admin_link_{unique_suffix}@example.com"
        create_admin_r = admin_client.post(f"{BASE_URL}/api/admin/create", json={
            "email": new_admin_email,
            "password": "password123",
        })
        if create_admin_r.status_code == 403:
            pytest.skip("Admin cap reached — cannot create another admin for link test")
        assert create_admin_r.status_code == 201, f"Create admin failed: {create_admin_r.text}"
        new_admin_id = create_admin_r.json()["id"]

        # 2. Verify GET /admin/list returns member=null for this new admin
        list_r = admin_client.get(f"{BASE_URL}/api/admin/list")
        assert list_r.status_code == 200
        new_admin_in_list = next((a for a in list_r.json() if a["id"] == new_admin_id), None)
        assert new_admin_in_list is not None
        assert new_admin_in_list["member"] is None

        # 3. POST /members/link-admin to create a member profile for that admin
        link_r = admin_client.post(f"{BASE_URL}/api/members/link-admin", json={
            "adminUserId": new_admin_id,
            "name": f"TEST_LinkedAdmin_{unique_suffix}",
            "customFieldValue": f"CFL-{unique_suffix}",
        })
        assert link_r.status_code == 201, f"link-admin failed: {link_r.text}"
        member_data = link_r.json()
        assert member_data["userId"] == new_admin_id
        assert member_data["name"].startswith("TEST_LinkedAdmin_")

        # 4. Verify GET /admin/list now returns member for this admin
        list_r2 = admin_client.get(f"{BASE_URL}/api/admin/list")
        admin_after = next((a for a in list_r2.json() if a["id"] == new_admin_id), None)
        assert admin_after is not None
        assert admin_after["member"] is not None
        assert "id" in admin_after["member"]

        # 5. Trying to link again must return 400
        link_r2 = admin_client.post(f"{BASE_URL}/api/members/link-admin", json={
            "adminUserId": new_admin_id,
            "name": f"TEST_LinkedAdmin2_{unique_suffix}",
        })
        assert link_r2.status_code == 400
        assert "déjà" in link_r2.json().get("error", "").lower() or "already" in link_r2.json().get("error", "").lower()

        # Cleanup: Delete the linked admin (as a member since he now has member profile)
        try:
            admin_client.delete(f"{BASE_URL}/api/members/{new_admin_id}")
        except Exception:
            pass

    def test_link_admin_missing_fields_returns_400(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/members/link-admin", json={"name": "no-admin-id"})
        assert r.status_code == 400
        r2 = admin_client.post(f"{BASE_URL}/api/members/link-admin", json={"adminUserId": "some-id"})
        assert r2.status_code == 400

    def test_link_admin_nonexistent_admin_returns_404(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/members/link-admin", json={
            "adminUserId": "00000000-0000-0000-0000-000000000000",
            "name": "TEST_NoAdmin",
        })
        assert r.status_code == 404


# ---- Part E: Password length validation ----

class TestPasswordValidation:
    """Part E - passwords < 8 chars must be rejected for both members and admins"""

    def test_member_short_password_rejected(self, admin_client, unique_suffix):
        r = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_ShortPwd_{unique_suffix}",
            "customFieldValue": f"SP-{unique_suffix}",
            "phone": f"77{unique_suffix[:8]}",
            "password": "short1",  # 6 chars
        })
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        assert "error" in body
        assert "8" in body["error"] or "court" in body["error"].lower() or "short" in body["error"].lower()

    def test_member_7_char_password_rejected(self, admin_client, unique_suffix):
        r = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_7char_{unique_suffix}",
            "customFieldValue": f"S7-{unique_suffix}",
            "phone": f"78{unique_suffix[:8]}",
            "password": "1234567",  # exactly 7 chars
        })
        assert r.status_code == 400
        body = r.json()
        assert "error" in body

    def test_member_8_char_password_accepted(self, admin_client, unique_suffix):
        r = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_8char_{unique_suffix}",
            "customFieldValue": f"S8-{unique_suffix}",
            "phone": f"79{unique_suffix[:8]}",
            "password": "12345678",  # exactly 8 chars
        })
        assert r.status_code == 201, f"Expected 201 for 8-char password, got {r.status_code}: {r.text}"
        # Cleanup
        try:
            admin_client.delete(f"{BASE_URL}/api/members/{r.json()['id']}")
        except Exception:
            pass

    def test_admin_short_password_rejected(self, admin_client, unique_suffix):
        r = admin_client.post(f"{BASE_URL}/api/admin/create", json={
            "email": f"test_shortpwd_{unique_suffix}@example.com",
            "password": "short",  # 5 chars
        })
        # Either 400 (short password) or 403 (admin cap reached)
        if r.status_code == 403:
            pytest.skip("Admin cap reached — cannot test short password on admin/create")
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        body = r.json()
        assert "error" in body
        assert "8" in body["error"] or "court" in body["error"].lower()

    def test_admin_7_char_password_rejected(self, admin_client, unique_suffix):
        r = admin_client.post(f"{BASE_URL}/api/admin/create", json={
            "email": f"test_7char_{unique_suffix}@example.com",
            "password": "1234567",  # 7 chars
        })
        if r.status_code == 403:
            pytest.skip("Admin cap reached")
        assert r.status_code == 400
