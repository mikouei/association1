"""
Tests for API Health and Authentication endpoints
"""
import pytest
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://db-persistence-fix.preview.emergentagent.com').rstrip('/')


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


class TestSuperAdminAuth:
    """Test SuperAdmin authentication"""
    
    def test_superadmin_login_success(self, api_client):
        """Test SuperAdmin login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": "superadmin@platform.local",
            "password": "superadmin"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "SUPER_ADMIN"
        assert data["user"]["email"] == "superadmin@platform.local"

    def test_superadmin_login_invalid_password(self, api_client):
        """Test SuperAdmin login with invalid password"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": "superadmin@platform.local",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "error" in response.json()

    def test_superadmin_login_missing_fields(self, api_client):
        """Test SuperAdmin login with missing fields"""
        response = api_client.post(f"{BASE_URL}/api/platform/login", json={
            "email": "superadmin@platform.local"
        })
        assert response.status_code == 400

    def test_superadmin_me_endpoint(self, superadmin_client):
        """Test GET /api/platform/me returns superadmin profile"""
        response = superadmin_client.get(f"{BASE_URL}/api/platform/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "SUPER_ADMIN"
        assert "email" in data


class TestAdminAuth:
    """Test Admin authentication with association code"""
    
    def test_admin_login_success(self, api_client):
        """Test Admin login with valid credentials and association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "drigo@drigo.local",
            "password": "drigo",
            "associationCode": "SYNDIC-BNI"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "ADMIN"
        assert data["association"]["code"] == "SYNDIC-BNI"

    def test_admin_login_wrong_association_code(self, api_client):
        """Test Admin login with wrong association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "drigo@drigo.local",
            "password": "drigo",
            "associationCode": "WRONG-CODE"
        })
        assert response.status_code == 404
        assert "error" in response.json()

    def test_admin_login_missing_association_code(self, api_client):
        """Test Admin login without association code"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "drigo@drigo.local",
            "password": "drigo"
        })
        assert response.status_code == 400
        assert "error" in response.json()

    def test_admin_login_invalid_credentials(self, api_client):
        """Test Admin login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "identifier": "drigo@drigo.local",
            "password": "wrongpassword",
            "associationCode": "SYNDIC-BNI"
        })
        assert response.status_code == 401

    def test_admin_me_endpoint(self, admin_client):
        """Test GET /api/auth/me returns admin profile with association"""
        response = admin_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "ADMIN"
        assert "association" in data
        assert data["association"]["code"] == "SYNDIC-BNI"

    def test_association_settings(self, admin_client):
        """Test GET /api/auth/association-settings returns config"""
        response = admin_client.get(f"{BASE_URL}/api/auth/association-settings")
        assert response.status_code == 200
        data = response.json()
        assert "enableVehiclePlates" in data
        assert "customFieldLabel" in data
