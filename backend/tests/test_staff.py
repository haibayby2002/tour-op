import pytest

from apps.accounts.models import User, UserRole
from apps.audit.models import AuditLog
from apps.notifications.models import Notification
from apps.profiles.models import LocalProfile
from apps.safety.models import Report

from .conftest import client_for, make_user


@pytest.fixture
def staff(reference):
    return make_user("staff@example.com", is_staff=True)


@pytest.mark.django_db
def test_staff_api_is_staff_only(traveler, local):
    for path in ("/api/v1/staff/overview/", "/api/v1/staff/users/", "/api/v1/staff/reports/", "/api/v1/staff/audit/"):
        assert client_for(None).get(path).status_code == 401
        assert client_for(traveler).get(path).status_code == 403
        assert client_for(local).post("/api/v1/staff/users/1/status/", {"status": "SUSPENDED"}).status_code == 403


@pytest.mark.django_db
def test_overview_counts(staff, traveler, local):
    Report.objects.create(reporter=traveler, reported_user=local, category="SAFETY", description="x", severity="CRITICAL")
    data = client_for(staff).get("/api/v1/staff/overview/").data
    assert data["users"]["total"] == 3
    assert data["users"]["locals"] == 1
    assert data["queues"]["open_reports"] == 1
    assert data["queues"]["critical_reports"] == 1


@pytest.mark.django_db
def test_user_search_and_suspend(staff, traveler, local):
    rows = client_for(staff).get("/api/v1/staff/users/", {"role": "LOCAL"}).data["results"]
    assert [r["email"] for r in rows] == ["local@example.com"]
    rows = client_for(staff).get("/api/v1/staff/users/", {"q": "travel"}).data["results"]
    assert [r["id"] for r in rows] == [traveler.id]

    response = client_for(staff).post(f"/api/v1/staff/users/{local.id}/status/", {"status": "SUSPENDED"}, format="json")
    assert response.status_code == 200
    local.refresh_from_db()
    assert local.status == User.Status.SUSPENDED
    assert AuditLog.objects.filter(action="SUSPENDED", entity_id=str(local.id), actor=staff).exists()

    # Can't lock yourself out, and BANNED/DELETED aren't settable here.
    assert client_for(staff).post(f"/api/v1/staff/users/{staff.id}/status/", {"status": "SUSPENDED"}).status_code == 400
    assert client_for(staff).post(f"/api/v1/staff/users/{local.id}/status/", {"status": "DELETED"}).status_code == 400


@pytest.mark.django_db
def test_report_workflow_notifies_reporter(staff, traveler, local):
    report = Report.objects.create(reporter=traveler, reported_user=local, category="OVERCHARGING", description="Extra fee")
    client = client_for(staff)
    detail = client.get(f"/api/v1/staff/reports/{report.id}/").data
    assert detail["reporter"]["email"] == traveler.email
    assert AuditLog.objects.filter(action="STAFF_VIEWED_REPORT", entity_id=str(report.id)).exists()

    data = client.patch(f"/api/v1/staff/reports/{report.id}/", {"assign_to_me": True}, format="json").data
    assert data["status"] == "IN_REVIEW" and data["assigned_to"]["id"] == staff.id

    data = client.patch(
        f"/api/v1/staff/reports/{report.id}/", {"status": "RESOLVED", "resolution_note": "Refunded"}, format="json"
    ).data
    assert data["status"] == "RESOLVED" and data["resolved_at"]
    assert Notification.objects.filter(user=traveler, kind="report_updated").exists()
    assert client.get("/api/v1/staff/reports/").data["count"] == 0  # default list is the active queue
    assert client.get("/api/v1/staff/reports/", {"status": "RESOLVED"}).data["count"] == 1


@pytest.mark.django_db
def test_local_manual_check(staff, local):
    LocalProfile.objects.filter(user=local).update(review_status=LocalProfile.ReviewStatus.PENDING)
    client = client_for(staff)
    assert [r["id"] for r in client.get("/api/v1/staff/locals/").data["results"]] == [local.id]
    data = client.post(f"/api/v1/staff/locals/{local.id}/review/", {"review_status": "MANUALLY_CHECKED"}, format="json").data
    assert data["review_status"] == "MANUALLY_CHECKED"
    assert AuditLog.objects.filter(action="MANUALLY_CHECKED", actor=staff).exists()
    assert local.roles.filter(role=UserRole.Role.LOCAL).exists()
