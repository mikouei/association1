# Tests for GET /api/members/:id/export-pdf endpoint
# Feature: Export PDF du relevé de paiements d'un membre
import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://mobile-bug-crush-1.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = 'admin@delete-test.local'
ADMIN_PASSWORD = 'admin123'
ASSOCIATION_CODE = 'DELETE-TEST'


@pytest.fixture(scope='module')
def admin_token():
    r = requests.post(f'{BASE_URL}/api/auth/login', json={
        'identifier': ADMIN_EMAIL,
        'password': ADMIN_PASSWORD,
        'associationCode': ASSOCIATION_CODE,
    }, timeout=15)
    assert r.status_code == 200, f'Login failed: {r.text}'
    return r.json()['token']


@pytest.fixture(scope='module')
def admin_headers(admin_token):
    return {'Authorization': f'Bearer {admin_token}'}


@pytest.fixture(scope='module')
def a_member_id(admin_headers):
    r = requests.get(f'{BASE_URL}/api/members', headers=admin_headers, timeout=15)
    assert r.status_code == 200
    members = r.json()
    active = [m for m in members if m.get('active')]
    assert active, 'Need at least one active member'
    return active[0]['id'], active[0]['name']


class TestExportPDF:
    def test_export_pdf_returns_pdf(self, admin_headers, a_member_id):
        member_id, name = a_member_id
        r = requests.get(f'{BASE_URL}/api/members/{member_id}/export-pdf', headers=admin_headers, timeout=30)
        assert r.status_code == 200, f'Body: {r.text[:300]}'
        assert 'application/pdf' in r.headers.get('Content-Type', ''), r.headers
        assert 'attachment' in r.headers.get('Content-Disposition', '')
        assert r.content.startswith(b'%PDF'), f'Not a valid PDF header: {r.content[:20]}'
        assert len(r.content) > 500

    def test_pdf_contains_member_info(self, admin_headers, a_member_id):
        from pypdf import PdfReader
        import io
        member_id, name = a_member_id
        r = requests.get(f'{BASE_URL}/api/members/{member_id}/export-pdf', headers=admin_headers, timeout=30)
        assert r.status_code == 200
        reader = PdfReader(io.BytesIO(r.content))
        text = ''.join(p.extract_text() or '' for p in reader.pages)
        assert 'Relevé des paiements' in text
        assert 'Membre:' in text
        assert name.split()[0] in text  # first name token
        assert 'Cotisations Mensuelles' in text
        assert 'TOTAL' in text.upper()
        assert 'Kotiz' in text

    def test_pdf_content_disposition_filename(self, admin_headers, a_member_id):
        member_id, _ = a_member_id
        r = requests.get(f'{BASE_URL}/api/members/{member_id}/export-pdf', headers=admin_headers, timeout=30)
        cd = r.headers.get('Content-Disposition', '')
        assert 'releve-' in cd
        assert cd.endswith('.pdf"') or cd.endswith('.pdf')

    def test_export_pdf_unauthorized_without_token(self, a_member_id):
        member_id, _ = a_member_id
        r = requests.get(f'{BASE_URL}/api/members/{member_id}/export-pdf', timeout=15)
        assert r.status_code in (401, 403)

    def test_export_pdf_nonexistent_member_returns_404(self, admin_headers):
        r = requests.get(f'{BASE_URL}/api/members/00000000-0000-0000-0000-000000000000/export-pdf', headers=admin_headers, timeout=15)
        assert r.status_code == 404

    def test_export_pdf_with_year_filter(self, admin_headers, a_member_id):
        member_id, _ = a_member_id
        r = requests.get(f'{BASE_URL}/api/members/{member_id}/export-pdf?year=2025', headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.content.startswith(b'%PDF')

    def test_export_pdf_member_role_forbidden(self, admin_headers, a_member_id):
        # Get a member's access token then attempt to export as MEMBER
        r = requests.get(f'{BASE_URL}/api/members', headers=admin_headers, timeout=15)
        members = r.json()
        active = [m for m in members if m.get('active') and m.get('token')]
        if not active:
            pytest.skip('No active member with access token available')
        m = active[0]
        # Login as member using access token
        r2 = requests.post(f'{BASE_URL}/api/auth/login', json={
            'accessToken': m['token'],
            'associationCode': ASSOCIATION_CODE,
        }, timeout=15)
        if r2.status_code != 200:
            pytest.skip(f'Cannot login as member: {r2.text}')
        member_jwt = r2.json()['token']
        r3 = requests.get(
            f'{BASE_URL}/api/members/{m["id"]}/export-pdf',
            headers={'Authorization': f'Bearer {member_jwt}'},
            timeout=15,
        )
        # requireAdmin -> should be 403
        assert r3.status_code in (401, 403), f'Expected 401/403, got {r3.status_code}: {r3.text[:200]}'
