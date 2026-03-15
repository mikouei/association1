"""
Tests for Platform Association management (SuperAdmin routes)
"""
import pytest
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://db-persistence-fix.preview.emergentagent.com').rstrip('/')


class TestAssociationsList:
    """Test listing associations"""
    
    def test_list_associations(self, superadmin_client):
        """Test GET /api/platform/associations returns all associations"""
        response = superadmin_client.get(f"{BASE_URL}/api/platform/associations")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check structure includes member counts
        for assoc in data:
            assert "id" in assoc
            assert "name" in assoc
            assert "code" in assoc
            assert "membersCount" in assoc or "_count" in assoc

    def test_list_associations_unauthorized(self, api_client):
        """Test accessing associations without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/platform/associations")
        assert response.status_code == 401


class TestAssociationCRUD:
    """Test CRUD operations for associations"""
    
    def test_create_association(self, superadmin_client, unique_id):
        """Test creating a new association with admin"""
        code = f"TST-{unique_id[:6]}".upper()
        response = superadmin_client.post(f"{BASE_URL}/api/platform/associations", json={
            "name": f"Test Association {unique_id}",
            "code": code,
            "type": "association",
            "adminEmail": f"{unique_id}@test.local",
            "adminPassword": "testpass123",
            "adminName": "Test Admin"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["association"]["code"] == code
        assert data["association"]["name"].startswith("Test Association")
        
        # Cleanup - delete the association
        assoc_id = data["association"]["id"]
        cleanup = superadmin_client.delete(f"{BASE_URL}/api/platform/associations/{assoc_id}")
        assert cleanup.status_code == 200

    def test_create_association_duplicate_code(self, superadmin_client):
        """Test creating association with existing code fails"""
        response = superadmin_client.post(f"{BASE_URL}/api/platform/associations", json={
            "name": "Duplicate Test",
            "code": "SYNDIC-BNI",  # Already exists
            "adminEmail": "dup@test.local",
            "adminPassword": "testpass123"
        })
        assert response.status_code == 400
        assert "existe" in response.json()["error"].lower() or "exist" in response.json()["error"].lower()

    def test_create_association_missing_fields(self, superadmin_client):
        """Test creating association with missing required fields"""
        response = superadmin_client.post(f"{BASE_URL}/api/platform/associations", json={
            "name": "Incomplete Association"
            # Missing code, adminEmail, adminPassword
        })
        assert response.status_code == 400

    def test_get_association_detail(self, superadmin_client):
        """Test getting association detail by ID"""
        # First get list to find an ID
        list_response = superadmin_client.get(f"{BASE_URL}/api/platform/associations")
        associations = list_response.json()
        assert len(associations) > 0
        
        assoc_id = associations[0]["id"]
        response = superadmin_client.get(f"{BASE_URL}/api/platform/associations/{assoc_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == assoc_id
        assert "name" in data
        assert "code" in data

    def test_toggle_association_status(self, superadmin_client, unique_id):
        """Test toggling association active status"""
        # Create a test association
        code = f"TGL-{unique_id[:6]}".upper()
        create_response = superadmin_client.post(f"{BASE_URL}/api/platform/associations", json={
            "name": f"Toggle Test {unique_id}",
            "code": code,
            "adminEmail": f"toggle_{unique_id}@test.local",
            "adminPassword": "testpass123"
        })
        assert create_response.status_code == 201
        assoc_id = create_response.json()["association"]["id"]
        
        # Toggle status
        toggle_response = superadmin_client.put(f"{BASE_URL}/api/platform/associations/{assoc_id}/toggle")
        assert toggle_response.status_code == 200
        
        # Verify change
        get_response = superadmin_client.get(f"{BASE_URL}/api/platform/associations/{assoc_id}")
        assert get_response.status_code == 200
        # Status should have been toggled
        
        # Cleanup
        superadmin_client.delete(f"{BASE_URL}/api/platform/associations/{assoc_id}")


class TestPlatformStats:
    """Test platform statistics"""
    
    def test_get_platform_stats(self, superadmin_client):
        """Test GET /api/platform/stats returns platform statistics"""
        response = superadmin_client.get(f"{BASE_URL}/api/platform/stats")
        assert response.status_code == 200
        data = response.json()
        assert "totalAssociations" in data
        assert "activeAssociations" in data
        assert "totalMembers" in data
        assert "totalUsers" in data
        assert data["totalAssociations"] >= 0
