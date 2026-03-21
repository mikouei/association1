"""
Tests for Members CRUD operations with multi-tenant isolation
"""
import pytest
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mobile-bug-crush-1.preview.emergentagent.com').rstrip('/')


class TestMembersList:
    """Test listing members"""
    
    def test_list_members(self, admin_client):
        """Test GET /api/members returns members for the association"""
        response = admin_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_members_unauthorized(self, api_client):
        """Test accessing members without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/members")
        assert response.status_code == 401


class TestMemberCRUD:
    """Test CRUD operations for members"""
    
    def test_create_member(self, admin_client, unique_id):
        """Test creating a new member"""
        response = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Test Member {unique_id}",
            "customFieldValue": f"Villa {unique_id[:4]}",
            "email": f"{unique_id}@member.test",
            "phone": f"+225{unique_id[:8]}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == f"Test Member {unique_id}"
        assert data["email"] == f"{unique_id}@member.test"
        assert "token" in data  # Access token should be returned to admin
        assert "id" in data
        
        # Verify by GET
        member_id = data["id"]
        get_response = admin_client.get(f"{BASE_URL}/api/members/{member_id}")
        assert get_response.status_code == 200
        assert get_response.json()["name"] == f"Test Member {unique_id}"
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/members/{member_id}")

    def test_create_member_missing_required_fields(self, admin_client, unique_id):
        """Test creating member without required fields fails"""
        response = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Incomplete {unique_id}"
            # Missing customFieldValue and email/phone
        })
        assert response.status_code == 400

    def test_create_member_duplicate_email(self, admin_client, unique_id):
        """Test creating member with duplicate email fails"""
        # Create first member
        email = f"dup_{unique_id}@test.local"
        first = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"First {unique_id}",
            "customFieldValue": "Villa 1",
            "email": email
        })
        assert first.status_code == 201
        first_id = first.json()["id"]
        
        # Try to create second with same email
        second = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Second {unique_id}",
            "customFieldValue": "Villa 2",
            "email": email
        })
        assert second.status_code == 400
        assert "email" in second.json()["error"].lower() or "utilisé" in second.json()["error"].lower()
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/members/{first_id}")

    def test_update_member(self, admin_client, unique_id):
        """Test updating a member"""
        # Create member
        create = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Update Test {unique_id}",
            "customFieldValue": "Villa Original",
            "email": f"update_{unique_id}@test.local"
        })
        assert create.status_code == 201
        member_id = create.json()["id"]
        
        # Update member
        update = admin_client.put(f"{BASE_URL}/api/members/{member_id}", json={
            "name": f"Updated Name {unique_id}",
            "customFieldValue": "Villa Updated"
        })
        assert update.status_code == 200
        assert update.json()["name"] == f"Updated Name {unique_id}"
        assert update.json()["customFieldValue"] == "Villa Updated"
        
        # Verify update persisted
        get = admin_client.get(f"{BASE_URL}/api/members/{member_id}")
        assert get.json()["customFieldValue"] == "Villa Updated"
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/members/{member_id}")

    def test_deactivate_and_activate_member(self, admin_client, unique_id):
        """Test deactivating and reactivating a member"""
        # Create member
        create = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Deactivate Test {unique_id}",
            "customFieldValue": "Villa Test",
            "email": f"deact_{unique_id}@test.local"
        })
        assert create.status_code == 201
        member_id = create.json()["id"]
        
        # Deactivate
        deactivate = admin_client.put(f"{BASE_URL}/api/members/{member_id}/deactivate")
        assert deactivate.status_code == 200
        
        # Verify deactivated
        get = admin_client.get(f"{BASE_URL}/api/members/{member_id}")
        assert get.json()["active"] == False
        
        # Reactivate
        activate = admin_client.put(f"{BASE_URL}/api/members/{member_id}/activate")
        assert activate.status_code == 200
        
        # Verify reactivated
        get2 = admin_client.get(f"{BASE_URL}/api/members/{member_id}")
        assert get2.json()["active"] == True
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/members/{member_id}")

    def test_delete_member(self, admin_client, unique_id):
        """Test deleting a member"""
        # Create member
        create = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Delete Test {unique_id}",
            "customFieldValue": "Villa Delete",
            "email": f"delete_{unique_id}@test.local"
        })
        assert create.status_code == 201
        member_id = create.json()["id"]
        
        # Delete
        delete = admin_client.delete(f"{BASE_URL}/api/members/{member_id}")
        assert delete.status_code == 200
        
        # Verify deleted
        get = admin_client.get(f"{BASE_URL}/api/members/{member_id}")
        assert get.status_code == 404

    def test_regenerate_member_token(self, admin_client, unique_id):
        """Test regenerating member access token"""
        # Create member
        create = admin_client.post(f"{BASE_URL}/api/members", json={
            "name": f"Token Test {unique_id}",
            "customFieldValue": "Villa Token",
            "email": f"token_{unique_id}@test.local"
        })
        assert create.status_code == 201
        member_id = create.json()["id"]
        original_token = create.json()["token"]
        
        # Regenerate token
        regen = admin_client.post(f"{BASE_URL}/api/members/{member_id}/regenerate-token")
        assert regen.status_code == 200
        new_token = regen.json()["token"]
        assert new_token != original_token
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/members/{member_id}")


class TestMultiTenantIsolation:
    """Test that data is properly isolated between associations"""
    
    def test_member_isolation_between_associations(self, superadmin_client, unique_id):
        """Test that members from different associations cannot see each other's data"""
        import requests
        
        # Create a new test association
        code = f"ISO-{unique_id[:6]}".upper()
        create_assoc = superadmin_client.post(f"{BASE_URL}/api/platform/associations", json={
            "name": f"Isolation Test {unique_id}",
            "code": code,
            "adminEmail": f"iso_admin_{unique_id}@test.local",
            "adminPassword": "testpass123"
        })
        assert create_assoc.status_code == 201
        new_assoc_id = create_assoc.json()["association"]["id"]
        
        try:
            # Login as admin of new association
            login = requests.post(f"{BASE_URL}/api/auth/login", json={
                "identifier": f"iso_admin_{unique_id}@test.local",
                "password": "testpass123",
                "associationCode": code
            }, headers={"Content-Type": "application/json"})
            assert login.status_code == 200
            new_admin_token = login.json()["token"]
            
            # Create member in new association
            create_member = requests.post(f"{BASE_URL}/api/members", json={
                "name": f"Isolated Member {unique_id}",
                "customFieldValue": "Isolated Villa",
                "email": f"iso_member_{unique_id}@test.local"
            }, headers={"Authorization": f"Bearer {new_admin_token}", "Content-Type": "application/json"})
            
            assert create_member.status_code == 201
            
            # Login as SYNDIC-BNI admin and get their members
            syndic_login = requests.post(f"{BASE_URL}/api/auth/login", json={
                "identifier": "drigo@drigo.local",
                "password": "drigo",
                "associationCode": "SYNDIC-BNI"
            }, headers={"Content-Type": "application/json"})
            
            assert syndic_login.status_code == 200
            
            syndic_members = requests.get(
                f"{BASE_URL}/api/members",
                headers={"Authorization": f"Bearer {syndic_login.json()['token']}"}
            )
            syndic_member_names = [m["name"] for m in syndic_members.json()]
            
            # Isolated member should NOT appear in SYNDIC-BNI member list
            assert f"Isolated Member {unique_id}" not in syndic_member_names
        finally:
            # Cleanup - delete association (cascades to members)
            superadmin_client.delete(f"{BASE_URL}/api/platform/associations/{new_assoc_id}")
