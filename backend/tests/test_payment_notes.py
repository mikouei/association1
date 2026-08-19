"""
Backend contract tests for the 'notes' field on POST/GET payments.

Covers the review request scope:
- POST /api/payments with {memberId, yearId, month, amountPaid, notes} => 201 + notes persisted
- GET  /api/payments/year/:yearId => member payments[].notes contains the stored note
- Updating an existing (member, year, month) triple with a new notes value updates it
- POST /api/payments without notes (or empty) does not break (backward compatibility)
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

# Kotiz ASCB seed (see /app/memory/test_credentials.md and review context)
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
    """Login admin ASCB - tries several payload shapes for identifier."""
    payloads = [
        {"identifier": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOCIATION_CODE},
        {"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOCIATION_CODE},
        {"email": ADMIN_PHONE, "password": ADMIN_PASSWORD, "associationCode": ASSOCIATION_CODE},
    ]
    last = None
    for body in payloads:
        r = api.post(f"{BASE_URL}/api/auth/login", json=body)
        last = r
        if r.status_code == 200 and r.json().get("token"):
            return r.json()["token"]
    pytest.skip(f"Admin ASCB login failed: {last.status_code} {last.text[:200]}")


@pytest.fixture(scope="module")
def admin(api, admin_token):
    api.headers.update({"Authorization": f"Bearer {admin_token}"})
    return api


@pytest.fixture(scope="module")
def year_id(admin):
    r = admin.get(f"{BASE_URL}/api/years")
    assert r.status_code == 200, f"GET /api/years => {r.status_code} {r.text[:200]}"
    years = r.json()
    # response might be a list or {years: [...]}
    if isinstance(years, dict):
        years = years.get("years") or years.get("data") or []
    target = next((y for y in years if y.get("year") == TARGET_YEAR), None)
    assert target, f"Year {TARGET_YEAR} not found in {[y.get('year') for y in years]}"
    return target["id"]


@pytest.fixture(scope="module")
def member_id(admin, year_id):
    r = admin.get(f"{BASE_URL}/api/payments/year/{year_id}")
    assert r.status_code == 200, f"GET matrix => {r.status_code} {r.text[:200]}"
    data = r.json()
    members = data.get("members", [])
    target = next((m for m in members if m.get("name") == TARGET_MEMBER_NAME), None)
    assert target, (
        f"Member '{TARGET_MEMBER_NAME}' not found in matrix; "
        f"members={[m.get('name') for m in members]}"
    )
    # Payments route accepts member.id or userId; the web sends member.id
    return target["id"]


def _get_month_notes(admin, year_id_, member_id_, month):
    r = admin.get(f"{BASE_URL}/api/payments/year/{year_id_}")
    assert r.status_code == 200
    m = next(x for x in r.json()["members"] if x["id"] == member_id_)
    month_data = m["paymentsByMonth"][str(month)]
    notes = [p.get("notes") for p in month_data.get("payments", [])]
    return month_data, notes


# ---------- tests ----------

class TestPaymentNotesContract:
    """Contract used by web/src/app/payments/page.tsx"""

    # Use a month unlikely to collide with pre-seeded data (Nov=11, Dec=12)
    MONTH_CREATE = 11
    MONTH_EMPTY = 12

    def test_1_create_payment_with_notes_persists(self, admin, year_id, member_id):
        note = f"TEST_notes_create_{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": self.MONTH_CREATE,
            "amountPaid": 5000,
            "notes": note,
        })
        assert r.status_code in (200, 201), f"POST => {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body.get("notes") == note, f"POST body notes mismatch: {body}"
        assert body.get("month") == self.MONTH_CREATE
        assert float(body.get("amountPaid")) == 5000.0

        # verify via GET matrix (what the web reads for preload)
        month_data, notes = _get_month_notes(admin, year_id, member_id, self.MONTH_CREATE)
        assert note in notes, f"note '{note}' not in matrix payments[].notes={notes}"
        assert month_data.get("amountPaid") >= 5000

    def test_2_update_payment_notes_is_updated(self, admin, year_id, member_id):
        new_note = f"TEST_notes_update_{uuid.uuid4().hex[:8]}"
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": self.MONTH_CREATE,
            "amountPaid": 5000,
            "notes": new_note,
        })
        assert r.status_code in (200, 201), f"POST update => {r.status_code} {r.text[:200]}"
        assert r.json().get("notes") == new_note

        # re-read
        _, notes = _get_month_notes(admin, year_id, member_id, self.MONTH_CREATE)
        assert new_note in notes, f"updated note not found; got {notes}"

    def test_3_post_without_notes_is_backward_compatible(self, admin, year_id, member_id):
        # Case A: notes key absent
        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": self.MONTH_EMPTY,
            "amountPaid": 5000,
        })
        assert r.status_code in (200, 201), f"POST no-notes => {r.status_code} {r.text[:200]}"
        # notes should be null (creation path); route sets `notes || null`
        assert r.json().get("notes") in (None, ""), f"expected null notes, got {r.json()}"

        # Case B: notes = "" on a NEW month (fresh member/year/month tuple)
        # We reuse MONTH_EMPTY (already exists after case A) -> this is an update path:
        # route uses `notes || existingPayment.notes` so empty string preserves existing.
        # To validate empty-string does not crash, test on the update path only.
        r2 = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": self.MONTH_EMPTY,
            "amountPaid": 5000,
            "notes": "",
        })
        assert r2.status_code in (200, 201), f"POST notes='' => {r2.status_code} {r2.text[:200]}"

    def test_4_update_clears_or_keeps_notes_predictably(self, admin, year_id, member_id):
        """
        Sanity check on the documented behavior of the POST route:
        `notes || existingPayment.notes` on update.
        After test_2, MONTH_CREATE has a non-empty note. Sending notes:"" keeps it.
        """
        _, before = _get_month_notes(admin, year_id, member_id, self.MONTH_CREATE)
        prev = next((n for n in before if n), None)
        assert prev, f"precondition: existing note expected, got {before}"

        r = admin.post(f"{BASE_URL}/api/payments", json={
            "memberId": member_id,
            "yearId": year_id,
            "month": self.MONTH_CREATE,
            "amountPaid": 5000,
            "notes": "",
        })
        assert r.status_code in (200, 201)
        _, after = _get_month_notes(admin, year_id, member_id, self.MONTH_CREATE)
        assert prev in after, (
            f"Empty-string notes on UPDATE should preserve previous note per route logic; "
            f"before={before} after={after}"
        )
