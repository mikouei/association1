"""
Tests for two features:
 1) memberFieldLabel default based on association type + admin edition via PUT /api/auth/association-settings
 2) Editing Year number via PUT /api/years/:id (with uniqueness check + payment persistence)
"""
import pytest
import requests
import os
import uuid
import random

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')


# ------------------- Helpers -------------------

def _sa_login():
    r = requests.post(f"{BASE_URL}/api/platform/login", json={
        "email": "drigo@drigo.local", "password": "drigo123"
    })
    assert r.status_code == 200, f"SA login failed: {r.text}"
    return r.json()["token"]


def _admin_login(identifier, password, code):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "identifier": identifier, "password": password, "associationCode": code
    })
    if r.status_code != 200:
        return None
    return r.json()["token"]


def _sa_headers():
    return {"Authorization": f"Bearer {_sa_login()}", "Content-Type": "application/json"}


def _short():
    return uuid.uuid4().hex[:8].upper()


def _create_association(sa_headers, association_type, code_prefix):
    code = f"{code_prefix}-{_short()}"
    admin_email = f"admin.{code.lower()}@test.local"
    payload = {
        "name": f"{code} Test Association",
        "type": association_type,
        "code": code,
        "adminEmail": admin_email,
        "adminPassword": "adminPwd1",
        "adminName": "Test Admin"
    }
    r = requests.post(f"{BASE_URL}/api/platform/associations",
                      headers=sa_headers, json=payload)
    assert r.status_code == 201, f"Create assoc failed: {r.text}"
    data = r.json()
    return {
        "id": data["association"]["id"],
        "code": code,
        "admin_email": admin_email,
        "admin_password": "adminPwd1",
        "association": data["association"]
    }


def _delete_association(sa_headers, assoc_id):
    try:
        requests.delete(f"{BASE_URL}/api/platform/associations/{assoc_id}",
                        headers=sa_headers)
    except Exception:
        pass


# =====================================================
# FEATURE 1 - memberFieldLabel defaults + edit endpoint
# =====================================================

class TestMemberFieldLabelDefaults:
    """Association creation must set proper default memberFieldLabel"""

    def test_amicale_default_fonction(self):
        sa_h = _sa_headers()
        assoc = _create_association(sa_h, "amicale", "TESTAMI")
        try:
            # From creation response
            assert assoc["association"]["memberFieldLabel"] == "Fonction", (
                f"Expected default 'Fonction' for amicale, got: {assoc['association'].get('memberFieldLabel')}"
            )
            # Verify persisted
            r = requests.get(f"{BASE_URL}/api/platform/associations/{assoc['id']}",
                             headers=sa_h)
            assert r.status_code == 200
            assert r.json()["memberFieldLabel"] == "Fonction"
        finally:
            _delete_association(sa_h, assoc["id"])

    def test_syndicat_default_villa(self):
        sa_h = _sa_headers()
        assoc = _create_association(sa_h, "syndicat", "TESTSYN")
        try:
            assert assoc["association"]["memberFieldLabel"] == "Villa", (
                f"Expected default 'Villa' for syndicat, got: {assoc['association'].get('memberFieldLabel')}"
            )
            r = requests.get(f"{BASE_URL}/api/platform/associations/{assoc['id']}",
                             headers=sa_h)
            assert r.status_code == 200
            assert r.json()["memberFieldLabel"] == "Villa"
        finally:
            _delete_association(sa_h, assoc["id"])

    def test_association_default_fonction(self):
        """Default 'association' type behaves like amicale (Fonction)."""
        sa_h = _sa_headers()
        assoc = _create_association(sa_h, "association", "TESTASS")
        try:
            assert assoc["association"]["memberFieldLabel"] == "Fonction"
        finally:
            _delete_association(sa_h, assoc["id"])


class TestAssociationSettingsEdit:
    """PUT /api/auth/association-settings"""

    @pytest.fixture
    def ephemeral_admin(self):
        """Create an isolated amicale association and its admin token."""
        sa_h = _sa_headers()
        assoc = _create_association(sa_h, "amicale", "TESTLBL")
        admin_token = _admin_login(assoc["admin_email"], assoc["admin_password"], assoc["code"])
        assert admin_token, "Admin token retrieval failed"
        yield {"assoc_id": assoc["id"], "code": assoc["code"], "admin_token": admin_token}
        _delete_association(sa_h, assoc["id"])

    def test_admin_can_update_member_field_label(self, ephemeral_admin):
        h = {"Authorization": f"Bearer {ephemeral_admin['admin_token']}",
             "Content-Type": "application/json"}
        r = requests.put(f"{BASE_URL}/api/auth/association-settings",
                         headers=h, json={"memberFieldLabel": "Matricule"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["customFieldLabel"] == "Matricule"

        # Persistence: GET settings
        g = requests.get(f"{BASE_URL}/api/auth/association-settings", headers=h)
        assert g.status_code == 200
        assert g.json()["customFieldLabel"] == "Matricule"

    def test_reject_empty_label(self, ephemeral_admin):
        h = {"Authorization": f"Bearer {ephemeral_admin['admin_token']}",
             "Content-Type": "application/json"}
        r = requests.put(f"{BASE_URL}/api/auth/association-settings",
                         headers=h, json={"memberFieldLabel": ""})
        assert r.status_code == 400, r.text
        assert "vide" in r.json().get("error", "").lower()

        # whitespace only
        r2 = requests.put(f"{BASE_URL}/api/auth/association-settings",
                          headers=h, json={"memberFieldLabel": "   "})
        assert r2.status_code == 400, r2.text

    def test_reject_non_admin(self, ephemeral_admin):
        """MEMBER user cannot change settings."""
        sa_h = _sa_headers()
        # Create a MEMBER by adding a member (creates linked user)
        admin_h = {"Authorization": f"Bearer {ephemeral_admin['admin_token']}",
                   "Content-Type": "application/json"}
        uniq = _short().lower()
        member_email = f"m_{uniq}@test.local"
        # Try to create member (route likely /api/members). We need a MEMBER token.
        # Most apps auto-create a user for the member. If not possible, we simulate by
        # asking SA to add another ADMIN and treat it as ADMIN? No - we need role=MEMBER.
        # Simpler: expect that /api/members POST returns creds. Attempt.
        cm = requests.post(f"{BASE_URL}/api/members", headers=admin_h, json={
            "name": f"Member Test {uniq}",
            "email": member_email,
            "customFieldValue": "Val"
        })
        if cm.status_code != 201:
            pytest.skip(f"Cannot create member for this test: {cm.status_code} {cm.text}")

        # A member may auto-get a token. Try login with the token OR with email/password.
        member_body = cm.json()
        token = member_body.get("accessToken") or member_body.get("token")
        member_token = None
        if token:
            lg = requests.post(f"{BASE_URL}/api/auth/login", json={
                "associationCode": ephemeral_admin["code"],
                "accessToken": token
            })
            if lg.status_code == 200:
                member_token = lg.json()["token"]

        if not member_token:
            pytest.skip("Could not obtain MEMBER token; skipping non-admin rejection test")

        h = {"Authorization": f"Bearer {member_token}",
             "Content-Type": "application/json"}
        r = requests.put(f"{BASE_URL}/api/auth/association-settings",
                         headers=h, json={"memberFieldLabel": "Hack"})
        assert r.status_code == 403, r.text
        assert "administrateur" in r.json().get("error", "").lower() or "admin" in r.json().get("error", "").lower()

    def test_unauthenticated_rejected(self):
        r = requests.put(f"{BASE_URL}/api/auth/association-settings",
                         json={"memberFieldLabel": "X"})
        assert r.status_code in (401, 403)


# =====================================================
# FEATURE 2 - PUT /api/years/:id year number update
# =====================================================

class TestYearNumberUpdate:
    """PUT /api/years/:id supports changing 'year' with uniqueness + preserves payments"""

    @pytest.fixture
    def admin_ctx(self):
        """Use the AMICALE-TEST admin for these tests."""
        token = _admin_login("admin@amicale-test.local", "admin123", "AMICALE-TEST")
        if not token:
            pytest.skip("AMICALE-TEST admin login failed")
        return {"headers": {"Authorization": f"Bearer {token}",
                            "Content-Type": "application/json"}}

    def _create_year(self, headers, year_num, monthly=10000):
        r = requests.post(f"{BASE_URL}/api/years", headers=headers, json={
            "year": year_num, "monthlyAmount": monthly, "active": False
        })
        assert r.status_code == 201, r.text
        return r.json()

    def _delete_year(self, headers, year_id):
        try:
            requests.delete(f"{BASE_URL}/api/years/{year_id}", headers=headers)
        except Exception:
            pass

    def test_update_year_number(self, admin_ctx):
        h = admin_ctx["headers"]
        # Valid range enforced by PUT: 2000-2100
        y1 = 2010 + random.randint(0, 20)
        y2 = 2040 + random.randint(0, 20)
        year = self._create_year(h, y1)
        try:
            r = requests.put(f"{BASE_URL}/api/years/{year['id']}",
                             headers=h, json={"year": y2})
            assert r.status_code == 200, r.text
            assert r.json()["year"] == y2

            # Verify persistence
            listing = requests.get(f"{BASE_URL}/api/years", headers=h).json()
            match = [y for y in listing if y["id"] == year["id"]]
            assert match and match[0]["year"] == y2
        finally:
            self._delete_year(h, year["id"])

    def test_update_year_conflict(self, admin_ctx):
        h = admin_ctx["headers"]
        y1 = 2065 + random.randint(0, 10)
        y2 = 2080 + random.randint(0, 15)
        a = self._create_year(h, y1)
        b = self._create_year(h, y2)
        try:
            r = requests.put(f"{BASE_URL}/api/years/{b['id']}",
                             headers=h, json={"year": y1})
            assert r.status_code == 400, r.text
            err = r.json().get("error", "").lower()
            assert "existe" in err or "déjà" in err or "deja" in err
        finally:
            self._delete_year(h, a["id"])
            self._delete_year(h, b["id"])

    def test_update_year_invalid_number(self, admin_ctx):
        h = admin_ctx["headers"]
        y1 = 2005 + random.randint(0, 3)
        year = self._create_year(h, y1)
        try:
            r = requests.put(f"{BASE_URL}/api/years/{year['id']}",
                             headers=h, json={"year": 1500})
            assert r.status_code == 400
            r2 = requests.put(f"{BASE_URL}/api/years/{year['id']}",
                              headers=h, json={"year": 2200})
            assert r2.status_code == 400
        finally:
            self._delete_year(h, year["id"])

    def test_payments_persist_after_year_number_change(self, admin_ctx):
        h = admin_ctx["headers"]
        y1 = 2025 + random.randint(0, 10)
        y2 = 2085 + random.randint(0, 10)

        # Create member
        uniq = _short().lower()
        m = requests.post(f"{BASE_URL}/api/members", headers=h, json={
            "name": f"TEST_YrChange {uniq}",
            "customFieldValue": f"Villa {uniq[:3]}",
            "email": f"yr_{uniq}@test.local"
        })
        assert m.status_code == 201, m.text
        member = m.json()

        year = self._create_year(h, y1)
        try:
            # Create payment
            p = requests.post(f"{BASE_URL}/api/payments", headers=h, json={
                "memberId": member["id"],
                "yearId": year["id"],
                "month": 3,
                "amountPaid": 10000
            })
            assert p.status_code == 201, p.text
            payment = p.json()

            # Update year number
            u = requests.put(f"{BASE_URL}/api/years/{year['id']}",
                             headers=h, json={"year": y2})
            assert u.status_code == 200
            assert u.json()["year"] == y2

            # Verify payment still attached to the same yearId
            gp = requests.get(f"{BASE_URL}/api/payments/year/{year['id']}",
                              headers=h)
            assert gp.status_code == 200, gp.text
            body = gp.json()
            # Response shape: {year:{...}, members:[{paymentsByMonth:{"3":{paid:true, payments:[...]}}}]}
            payments_found = False
            for m_entry in body.get("members", []):
                if m_entry.get("id") != member["id"] and m_entry.get("userId") != member["id"]:
                    continue
                by_month = m_entry.get("paymentsByMonth", {})
                m3 = by_month.get("3") or by_month.get(3) or {}
                if m3.get("paid") and float(m3.get("amountPaid", 0)) == 10000:
                    # Confirm payment references our stored payment id
                    for pay in m3.get("payments", []):
                        if pay.get("id") == payment.get("id") and pay.get("yearId") == year["id"]:
                            payments_found = True
                            break
            assert payments_found, f"Payment not found after year rename. body={body}"

            # Also check that year label in response uses new value
            year_meta = body.get("year") or {}
            if isinstance(year_meta, dict):
                assert year_meta.get("year") == y2
        finally:
            # Cleanup payment auto-cascades with member; delete member first
            requests.delete(f"{BASE_URL}/api/members/{member['id']}", headers=h)
            # Year may still have payments if member wasn't hard-deleted -> best effort
            self._delete_year(h, year["id"])

    def test_non_admin_cannot_update_year(self):
        """PUT /api/years/:id requires ADMIN. Unauthenticated → 401."""
        r = requests.put(f"{BASE_URL}/api/years/some-fake-id", json={"year": 2050})
        assert r.status_code in (401, 403)
