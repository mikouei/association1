"""
Pytest configuration and fixtures for AssocManager API tests
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')

# Test credentials (new PostgreSQL Render DB - Jan 2026)
SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"
ADMIN_EMAIL = "admin@test-new-db.local"
ADMIN_PASSWORD = "admin123"
ASSOCIATION_CODE = "TEST-NEW-DB"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def superadmin_token(api_client):
    """Get SuperAdmin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/platform/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"SuperAdmin authentication failed: {response.text}")


@pytest.fixture
def superadmin_client(api_client, superadmin_token):
    """Session with SuperAdmin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {superadmin_token}"})
    return api_client


@pytest.fixture
def admin_token(api_client):
    """Get Admin authentication token for SYNDIC-BNI association"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "associationCode": ASSOCIATION_CODE
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.text}")


@pytest.fixture
def admin_client(api_client, admin_token):
    """Session with Admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api_client


@pytest.fixture
def unique_id():
    """Generate unique identifier for test data"""
    return f"{uuid.uuid4().hex[:12]}_{datetime.now().strftime('%H%M%S')}"
