"""
Backend contract tests for the BUG FIX on payments 'notes' field.

Review request:
- POST /api/payments (admin ASCB): if notes provided but empty ('') -> notes must be CLEARED (null).
  If notes not provided (key absent) -> keep existing (backward compat).
  If notes='X' -> persisted as 'X'.
- PUT  /api/payments/:id: notes='' -> cleared to null; notes absent -> unchanged; notes='X' -> 'X'.
- Creation with notes='' or absent -> notes=null, no error.
- No regression on amountPaid / paymentDate.

Fix under test:
- backend/routes/payments.js POST update path: `if (notes !== undefined) updatedData.notes = notes || null`
- backend/routes/payments.js PUT: `if (notes !== undefined) updateData.notes = notes || null`
"""
import os
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    or os.environ.get('EXPO_BACKEND_URL')
    or os.environ.get('REACT_APP_BACKEND_URL')
).rstrip('/')

ASSOCIATION_CODE = "ASCB"
ADMIN_PHONE = "+2250708510832"
ADMIN_PASSWORD = "admin123"
TARGET_MEMBER_NAME = "Membre Note"
TARGET_YEAR = 2026


# ---------- fixtures ----------

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    for body in [
        {"identifier": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOCIATION_CODE},
        {"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOCIATION_CODE},
    ]:
        r = api.post(f"{BASE_URL}/api/auth/login", json=body)
        if r.status_code == 200 and r.json().get("token"):
            return r.json()["token"]
    pytest.skip(f"Admin ASCB login failed: {r.status_code} {r.text[:200]}")


@pytest.fixture(scope="module")
def admin(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


@pytest.fixture(scope="module")
def year_id(admin):
    r = admin.get(f"{BASE_URL}/api/years")
    assert r.status_code == 200, r.text[:200]
    years = r.json()
    if isinstance(years, dict):
        years = years.get("years") or years.get("data") or []
    target = next((y for y in years if y.get("year") == TARGET_YEAR), None)
    assert target, f"Year {TARGET_YEAR} not found"
    return target["id"]


@pytest.fixture(scope="module")
def member_id(admin, year_id):
    r = admin.get(f"{BASE_URL}/api/payments/year/{year_id}")
    assert r.status_code == 200, r.text[:200]
    members = r.json().get("members", [])
    target = next((m for m in members if m.get("name") == TARGET_MEMBER_NAME), None)
    assert target, f"Member '{TARGET_MEMBER_NAME}' not found: {[m.get('name') for m in members]}"
    return target["id"]


def _get_payment_for_month(admin, yid, mid, month):
    """Return the (single) payment dict for member/year/month, or None."""
    r = admin.get(f"{BASE_URL}/api/payments/year/{yid}")
    assert r.status_code == 200
    m = next(x for x in r.json()["members"] if x["id"] == mid)
    payments = m["paymentsByMonth"][str(month)].get("payments", [])
    return payments[0] if payments else None


def _cleanup_month(admin, yid, mid, month):
    """Delete any existing payment for this member/year/month to start fresh."""
    p = _get_payment_for_month(admin, yid, mid, month)
    if p:
        admin.delete(f"{BASE_URL}/api/payments/{p['id']}")


# ---------- POST /api/payments (upsert) ----------

class TestPostPaymentNotesClear:
    """Core of the fix: distinguish 'notes not provided' vs 'notes provided empty'."""

    MONTH = 6  # Juin - free month per review

    @pytest.fixture(autouse=True)
    def _clean(self, admin, year_id, member_id):
        _cleanup_month(admin, year_id, member_id, self.MONTH)
        yield
        _cleanup_month(admin, year_id, member_id, self.MONTH)

    def test_1_create_with_notes_persists(self, admin, year_id, member_id):
        note = f"TEST_note_{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": note,
        })
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}"
        assert r.json().get("notes") == note

        p = _get_payment_for_month(admin, year_id, member_id, self.MONTH)
        assert p and p.get("notes") == note

    def test_2_update_with_empty_notes_CLEARS_note(self, admin, year_id, member_id):
        """CORE BUG FIX: sending notes='' on an existing payment must set notes to null."""
        # seed a payment WITH a note
        note = f"TEST_toClear_{uuid.uuid4().hex[:8]}"
        r1 = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": note,
        })
        assert r1.status_code in (200, 201)
        assert r1.json().get("notes") == note

        # now clear via empty string
        r2 = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": "",
        })
        assert r2.status_code in (200, 201), f"{r2.status_code} {r2.text[:200]}"
        assert r2.json().get("notes") in (None, ""), (
            f"BUG: empty notes should clear (null), got {r2.json().get('notes')!r}"
        )
        # be strict: must be None
        assert r2.json().get("notes") is None, (
            f"Expected None after clearing, got {r2.json().get('notes')!r}"
        )

        p = _get_payment_for_month(admin, year_id, member_id, self.MONTH)
        assert p is not None
        assert p.get("notes") is None, f"DB should have null notes, got {p.get('notes')!r}"

    def test_3_update_without_notes_key_KEEPS_existing(self, admin, year_id, member_id):
        """Compat: no notes key -> preserve prior note."""
        note = f"TEST_keep_{uuid.uuid4().hex[:8]}"
        admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": note,
        })

        # update WITHOUT notes key: amount changes, note preserved
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 7500,
        })
        assert r.status_code in (200, 201)
        assert r.json().get("notes") == note, (
            f"Note must be preserved when notes key absent, got {r.json().get('notes')!r}"
        )
        assert float(r.json().get("amountPaid")) == 7500.0

    def test_4_create_without_notes_yields_null(self, admin, year_id, member_id):
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000,
        })
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}"
        assert r.json().get("notes") is None

    def test_5_create_with_empty_notes_yields_null(self, admin, year_id, member_id):
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": "",
        })
        assert r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}"
        assert r.json().get("notes") is None

    def test_6_amount_and_date_not_regressed(self, admin, year_id, member_id):
        """No regression on amountPaid / paymentDate when toggling notes."""
        # create with a note and a specific date
        pay_date = "2026-06-15T10:00:00.000Z"
        r1 = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 3000, "notes": "hello", "paymentDate": pay_date,
        })
        assert r1.status_code in (200, 201)
        assert float(r1.json()["amountPaid"]) == 3000.0
        assert r1.json().get("paymentDate", "").startswith("2026-06-15")

        # clear notes, change amount & date
        new_date = "2026-06-20T09:00:00.000Z"
        r2 = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 4200, "notes": "", "paymentDate": new_date,
        })
        assert r2.status_code in (200, 201)
        body = r2.json()
        assert body.get("notes") is None
        assert float(body["amountPaid"]) == 4200.0
        assert body.get("paymentDate", "").startswith("2026-06-20")


# ---------- PUT /api/payments/:id ----------

class TestPutPaymentNotesClear:

    MONTH = 7  # Juillet

    @pytest.fixture(autouse=True)
    def _clean(self, admin, year_id, member_id):
        _cleanup_month(admin, year_id, member_id, self.MONTH)
        yield
        _cleanup_month(admin, year_id, member_id, self.MONTH)

    def _seed(self, admin, year_id, member_id, note="seedNote"):
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id, "yearId": year_id, "month": self.MONTH,
            "amountPaid": 5000, "notes": note,
        })
        assert r.status_code in (200, 201)
        return r.json()

    def test_1_put_empty_notes_CLEARS(self, admin, year_id, member_id):
        p = self._seed(admin, year_id, member_id, note=f"PUT_{uuid.uuid4().hex[:6]}")
        r = admin.put(f"{BASE_URL}/api/payments/{p['id']}", json={"notes": ""})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert r.json().get("notes") is None, (
            f"PUT with notes='' should clear, got {r.json().get('notes')!r}"
        )
        # re-read
        p2 = _get_payment_for_month(admin, year_id, member_id, self.MONTH)
        assert p2.get("notes") is None

    def test_2_put_without_notes_key_KEEPS(self, admin, year_id, member_id):
        note = f"PUT_keep_{uuid.uuid4().hex[:6]}"
        p = self._seed(admin, year_id, member_id, note=note)
        r = admin.put(f"{BASE_URL}/api/payments/{p['id']}", json={"amountPaid": 6000})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        assert r.json().get("notes") == note
        assert float(r.json().get("amountPaid")) == 6000.0

    def test_3_put_with_notes_updates(self, admin, year_id, member_id):
        p = self._seed(admin, year_id, member_id, note="old")
        new_note = f"PUT_new_{uuid.uuid4().hex[:6]}"
        r = admin.put(f"{BASE_URL}/api/payments/{p['id']}", json={"notes": new_note})
        assert r.status_code == 200
        assert r.json().get("notes") == new_note

    def test_4_put_no_regression_on_amount_and_date(self, admin, year_id, member_id):
        p = self._seed(admin, year_id, member_id, note="n1")
        new_date = "2026-07-05T08:30:00.000Z"
        r = admin.put(f"{BASE_URL}/api/payments/{p['id']}", json={
            "amountPaid": 9999, "paymentDate": new_date, "notes": "",
        })
        assert r.status_code == 200
        body = r.json()
        assert body.get("notes") is None
        assert float(body["amountPaid"]) == 9999.0
        assert body.get("paymentDate", "").startswith("2026-07-05")
