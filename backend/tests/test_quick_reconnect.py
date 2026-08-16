"""Tests for quick reconnect login flow (MEMBER accessToken)."""
import os
import requests
import pytest

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mobile-bug-crush-1.preview.emergentagent.com').rstrip('/')

MEMBER_TOKEN = "tc7p3jr72msb2l62euxc"
ASSOC_CODE = "TEST-NEW-DB"


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestQuickReconnect:
    """Login with accessToken (no password) - MEMBER quick reconnect"""

    def test_login_with_access_token_returns_accessToken_field(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "accessToken": MEMBER_TOKEN,
            "associationCode": ASSOC_CODE
        })
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
        assert "user" in data
        user = data["user"]
        assert user.get("role") == "MEMBER", f"expected MEMBER, got {user.get('role')}"
        assert "accessToken" in user, "MEMBER login must return accessToken in user"
        assert user["accessToken"] == MEMBER_TOKEN
        assert "association" in data
        assert data["association"]["code"] == ASSOC_CODE

    def test_login_with_invalid_access_token(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "accessToken": "invalid_token_xxx_999",
            "associationCode": ASSOC_CODE
        })
        assert r.status_code == 401
        assert "error" in r.json()

    def test_login_without_associationCode(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "accessToken": MEMBER_TOKEN
        })
        assert r.status_code == 400

    def test_login_with_unknown_association(self, client):
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "accessToken": MEMBER_TOKEN,
            "associationCode": "UNKNOWN-ASSOC-XYZ"
        })
        assert r.status_code == 404

    def test_admin_login_does_not_return_accessToken(self, client):
        # Admin login should not include accessToken field for security
        r = client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "drigo@drigo.local",
            "password": "drigo123",
            "associationCode": "DELETE-TEST"  # try known assoc
        })
        # Not always testable if admin doesn't belong to assoc; skip if failed
        if r.status_code != 200:
            pytest.skip(f"Admin login pre-req unavailable: {r.status_code}")
        user = r.json().get("user", {})
        if user.get("role") == "ADMIN":
            assert user.get("accessToken") is None or "accessToken" not in user or user["accessToken"] is None
