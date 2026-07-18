"""
Tests for API Health and Authentication endpoints
(Updated Jan 2026 - new Render PostgreSQL DB)
"""
import pytest
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-bug-crush-1.preview.emergentagent.com').rstrip('/')

SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"
ADMIN_EMAIL = "admin@test-new-db.local"
ADMIN_PASSWORD = "admin123"
ASSOCIATION_CODE = "TEST-NEW-DB"


class TestHealthCheck:
    """Test API health and basic endpoints"""

    def test_api_root(self, api_client):
        """Test /api root endpoint returns correct info"""
        response = api_client.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "OK"
        assert data["database"] == "PostgreSQL"
        assert "version" in data

    def test_get_associations_list(self, api_client):
        """Test GET /api/auth/associations returns active associations"""
        response = api_client.get(f"{BASE_URL}/api/auth/associations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        for assoc in data:
            assert "id" in assoc
            assert "name" in assoc
            assert "code" in assoc
        # Ensure known test association exists
        codes = [a["code"] for a in data]
        assert ASSOCIATION_CODE in codes


class TestSuperAdminAuth:
    """Test SuperAdmin authentication"""

    def test_superadmin_login_success(self, api_client):
        """Test SuperAdmin login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": SUPERADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        assert data["user"]["email"] == SUPERADMIN_EMAIL

    def test_superadmin_login_invalid_password(self, api_client):
        """Test SuperAdmin login with invalid password"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": SUPERADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "error" in response.json()

    def test_superadmin_login_missing_fields(self, api_client):
        """Test SuperAdmin login with missing fields"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": SUPERADMIN_EMAIL
        })
        assert response.status_code == 400

    def test_superadmin_me_endpoint(self, superadmin_client):
        """Test GET /api/platform/me returns superadmin profile"""
        response = superadmin_client.get(f"{BASE_URL}/api/platform/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "SUPER_ADMIN"
        assert data["email"] == SUPERADMIN_EMAIL


class TestAdminAuth:
    """Test Admin authentication with association code"""

    def test_admin_login_success(self, api_client):
        """Test Admin login with valid credentials and association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "associationCode": ASSOCIATION_CODE
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "ADMIN"
        assert data["association"]["code"] == ASSOCIATION_CODE

    def test_admin_login_wrong_association_code(self, api_client):
        """Test Admin login with wrong association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "associationCode": "WRONG-CODE"
        })
        assert response.status_code == 404
        assert "error" in response.json()

    def test_admin_login_missing_association_code(self, api_client):
        """Test Admin login without association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 400
        assert "error" in response.json()

    def test_admin_login_invalid_credentials(self, api_client):
        """Test Admin login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": "wrongpassword",
            "associationCode": ASSOCIATION_CODE
        })
        assert response.status_code == 401

    def test_admin_me_endpoint(self, admin_client):
        """Test GET /api/auth/me returns admin profile with association"""
        response = admin_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "ADMIN"
        assert "association" in data
        assert data["association"]["code"] == ASSOCIATION_CODE

    def test_association_settings(self, admin_client):
        """Test GET /api/auth/association-settings returns config"""
        response = admin_client.get(f"{BASE_URL}/api/auth/association-settings")
        assert response.status_code == 200
        data = response.json()
        assert "enableVehiclePlates" in data
        assert "customFieldLabel" in data
