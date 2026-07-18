"""
Multi-tenant isolation security tests
======================================
Verifies that the security fixes for PUT/DELETE /api/payments/:id
and PUT/DELETE /api/exceptional/payments/:paymentId correctly reject
cross-association attempts.

Scenario:
  - Admin A of Association A creates a payment (monthly + exceptional).
  - Admin B of Association B tries to UPDATE / DELETE that payment.
  - The API MUST reply with 404 (`Paiement introuvable`) and the payment MUST
    remain unchanged in the DB.
"""
import os
import random
import string
import time
import pytest
import requests

BASE_URL = (
    os.environ.get('REACT_APP_BACKEND_URL')
    or os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or 'https://mobile-bug-crush-1.preview.emergentagent.com'
).rstrip('/')

SUPERADMIN_EMAIL = "drigo@drigo.local"
SUPERADMIN_PASSWORD = "drigo123"


def _rand(n=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=n))


@pytest.fixture(scope="module")
def superadmin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/platform/login", json={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    }, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"SuperAdmin login failed ({r.status_code}): {r.text}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="module")
def two_associations(superadmin_session):
    """
    Provision two temporary associations (A and B) with their own admin users.
    Yields dict with tokens and association ids. Cleans up at end.
    """
    created = []
    assocs = {}
    try:
        for label in ("A", "B"):
            suffix = _rand(6)
            payload = {
                "name": f"TEST_ISO_{label}_{suffix}",
                "type": "association",
                "code": f"TEST-ISO-{label}-{suffix}".upper(),
                "adminEmail": f"test_iso_{label}_{suffix}@test.local",
                "adminPassword": "isotest123",
                "adminName": f"Iso Admin {label}",
            }
            r = superadmin_session.post(
                f"{BASE_URL}/api/platform/associations",
                json=payload, timeout=30
            )
            if r.status_code != 201:
                pytest.skip(f"Cannot create test association {label}: "
                            f"{r.status_code} {r.text}")
            assoc = r.json()["association"]
            created.append(assoc["id"])

            # Login as association admin
            login = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "identifier": payload["adminEmail"],
                    "password": payload["adminPassword"],
                    "associationCode": payload["code"],
                }, timeout=30,
            )
            if login.status_code != 200:
                pytest.skip(f"Admin {label} login failed: "
                            f"{login.status_code} {login.text}")
            token = login.json()["token"]

            client = requests.Session()
            client.headers.update({
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            })

            assocs[label] = {
                "id": assoc["id"],
                "code": payload["code"],
                "email": payload["adminEmail"],
                "client": client,
            }
        yield assocs
    finally:
        # Cleanup
        for assoc_id in created:
            try:
                superadmin_session.delete(
                    f"{BASE_URL}/api/platform/associations/{assoc_id}",
                    timeout=30,
                )
            except Exception:
                pass


class TestMonthlyPaymentIsolation:
    """PUT/DELETE /api/payments/:id must reject cross-association writes"""

    @pytest.fixture
    def payment_in_A(self, two_associations):
        """Create a member, a year and a monthly payment in association A."""
        A = two_associations["A"]
        c = A["client"]

        # Member
        m = c.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_ISO_Member_{_rand()}",
            "customFieldValue": f"Villa {_rand(3)}",
            "email": f"iso_member_{_rand()}@test.local",
        }, timeout=30)
        assert m.status_code == 201, m.text
        member_id = m.json()["id"]

        # Year
        year_num = 5000 + random.randint(1, 999)
        y = c.post(f"{BASE_URL}/api/years", json={
            "year": year_num, "monthlyAmount": 10000, "active": False,
        }, timeout=30)
        assert y.status_code == 201, y.text
        year_id = y.json()["id"]

        # Payment
        p = c.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": 1,
            "amountPaid": 10000,
        }, timeout=30)
        assert p.status_code == 201, p.text
        payment = p.json()

        yield {"payment": payment, "member_id": member_id, "year_id": year_id}

        # Cleanup
        c.delete(f"{BASE_URL}/api/payments/{payment['id']}", timeout=30)
        c.delete(f"{BASE_URL}/api/years/{year_id}", timeout=30)
        c.delete(f"{BASE_URL}/api/members/{member_id}", timeout=30)

    def test_admin_B_cannot_update_payment_of_A(self, two_associations, payment_in_A):
        B = two_associations["B"]["client"]
        payment = payment_in_A["payment"]

        r = B.put(f"{BASE_URL}/api/payments/{payment['id']}", json={
            "amountPaid": 99999,
        }, timeout=30)
        # Must be blocked
        assert r.status_code == 404, (
            f"SECURITY BUG: Admin B was able to update Admin A's payment "
            f"(status={r.status_code}, body={r.text})"
        )

        # Verify the payment is unchanged from Admin A's perspective
        A = two_associations["A"]["client"]
        verify = A.get(
            f"{BASE_URL}/api/payments/member/{payment_in_A['member_id']}"
            f"/year/{payment_in_A['year_id']}",
            timeout=30,
        )
        assert verify.status_code == 200, verify.text
        month_data = verify.json()["paymentsByMonth"]["1"]
        assert month_data["amountPaid"] == 10000, (
            f"Payment amount was tampered! Now: {month_data['amountPaid']}"
        )

    def test_admin_B_cannot_delete_payment_of_A(self, two_associations, payment_in_A):
        B = two_associations["B"]["client"]
        payment = payment_in_A["payment"]

        r = B.delete(f"{BASE_URL}/api/payments/{payment['id']}", timeout=30)
        assert r.status_code == 404, (
            f"SECURITY BUG: Admin B was able to delete Admin A's payment "
            f"(status={r.status_code}, body={r.text})"
        )

        # Confirm the payment still exists (Admin A must still see it)
        A = two_associations["A"]["client"]
        verify = A.get(
            f"{BASE_URL}/api/payments/member/{payment_in_A['member_id']}"
            f"/year/{payment_in_A['year_id']}",
            timeout=30,
        )
        assert verify.status_code == 200
        assert verify.json()["paymentsByMonth"]["1"]["amountPaid"] == 10000

    def test_admin_A_can_update_own_payment(self, two_associations, payment_in_A):
        """Sanity check: legitimate admin still works."""
        A = two_associations["A"]["client"]
        payment = payment_in_A["payment"]

        r = A.put(f"{BASE_URL}/api/payments/{payment['id']}", json={
            "amountPaid": 12000,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["amountPaid"] == 12000


class TestExceptionalPaymentIsolation:
    """PUT/DELETE /api/exceptional/payments/:paymentId must reject cross-association writes"""

    @pytest.fixture
    def exc_payment_in_A(self, two_associations):
        A = two_associations["A"]["client"]

        # Member
        m = A.post(f"{BASE_URL}/api/members", json={
            "name": f"TEST_ISO_ExcMember_{_rand()}",
            "customFieldValue": f"Villa {_rand(3)}",
            "email": f"iso_exc_{_rand()}@test.local",
        }, timeout=30)
        assert m.status_code == 201, m.text
        member_id = m.json()["id"]

        # Contribution
        contrib = A.post(f"{BASE_URL}/api/exceptional", json={
            "title": f"TEST_ISO_Contrib_{_rand()}",
            "type": "solidarité",
        }, timeout=30)
        assert contrib.status_code == 201, contrib.text
        contrib_id = contrib.json()["id"]

        # Payment
        p = A.post(f"{BASE_URL}/api/exceptional/{contrib_id}/payments", json={
            "memberId": member_id,
            "amount": 3000,
            "notes": "iso-test",
        }, timeout=30)
        assert p.status_code == 201, p.text
        payment = p.json()

        yield {
            "payment": payment,
            "contrib_id": contrib_id,
            "member_id": member_id,
        }

        # Cleanup
        A.delete(f"{BASE_URL}/api/exceptional/payments/{payment['id']}", timeout=30)
        A.delete(f"{BASE_URL}/api/exceptional/{contrib_id}", timeout=30)
        A.delete(f"{BASE_URL}/api/members/{member_id}", timeout=30)

    def test_admin_B_cannot_update_exc_payment_of_A(self, two_associations, exc_payment_in_A):
        B = two_associations["B"]["client"]
        payment = exc_payment_in_A["payment"]

        r = B.put(f"{BASE_URL}/api/exceptional/payments/{payment['id']}", json={
            "amount": 99999,
        }, timeout=30)
        assert r.status_code == 404, (
            f"SECURITY BUG: Admin B updated Admin A's exceptional payment "
            f"(status={r.status_code}, body={r.text})"
        )

        # Verify amount unchanged
        A = two_associations["A"]["client"]
        verify = A.get(
            f"{BASE_URL}/api/exceptional/{exc_payment_in_A['contrib_id']}",
            timeout=30,
        )
        assert verify.status_code == 200
        payments = verify.json()["payments"]
        original = next((p for p in payments if p["id"] == payment["id"]), None)
        assert original is not None
        assert original["amount"] == 3000

    def test_admin_B_cannot_delete_exc_payment_of_A(self, two_associations, exc_payment_in_A):
        B = two_associations["B"]["client"]
        payment = exc_payment_in_A["payment"]

        r = B.delete(f"{BASE_URL}/api/exceptional/payments/{payment['id']}", timeout=30)
        assert r.status_code == 404, (
            f"SECURITY BUG: Admin B deleted Admin A's exceptional payment "
            f"(status={r.status_code}, body={r.text})"
        )

        # Verify payment still exists
        A = two_associations["A"]["client"]
        verify = A.get(
            f"{BASE_URL}/api/exceptional/{exc_payment_in_A['contrib_id']}",
            timeout=30,
        )
        assert verify.status_code == 200
        payments = verify.json()["payments"]
        assert any(p["id"] == payment["id"] for p in payments), \
            "Payment was deleted by unauthorized admin B"

    def test_admin_A_can_update_own_exc_payment(self, two_associations, exc_payment_in_A):
        A = two_associations["A"]["client"]
        payment = exc_payment_in_A["payment"]

        r = A.put(f"{BASE_URL}/api/exceptional/payments/{payment['id']}", json={
            "amount": 4500,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["amount"] == 4500
