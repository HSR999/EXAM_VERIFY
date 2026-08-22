import os
from pathlib import Path

TEST_DB = Path(__file__).with_name("test_examverify.db")
os.environ["EXAMVERIFY_DB"] = str(TEST_DB)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["privacy_engine"] == "active"


def test_digilocker_success_and_missing_document():
    headers = {
        "X-Viewer-Role": "invigilator",
        "X-Viewer-Intent": "live_verification",
        "X-Viewer-Context": "exam_in_progress",
    }
    response = client.get("/digilocker/fetch/JEE25BPL0042", headers=headers)
    assert response.status_code == 200
    assert response.json()["document"]["CertificateData"]["RollNumber"] == "JEE25BPL0042"
    assert response.json()["document"]["IssuedTo"]["Person"]["name"] == "Rahul Sharma"
    assert response.json()["document"]["CertificateData"]["PhotoURL"] is not None
    assert response.json()["sandbox_mode"] is True

    missing = client.get("/digilocker/fetch/UNKNOWN", headers=headers)
    assert missing.status_code == 404


def test_guest_context_redacts_prediction_and_identity_data():
    headers = {
        "X-Viewer-Role": "guest_demo",
        "X-Viewer-Intent": "demo_walkthrough",
        "X-Viewer-Context": "exam_in_progress",
    }
    response = client.get("/digilocker/fetch/JEE25BPL0042", headers=headers)
    assert response.status_code == 200
    data = response.json()
    cert = data["document"]["CertificateData"]
    person = data["document"]["IssuedTo"]["Person"]
    assert person["name"] == "R*** S***"
    assert cert["RollNumber"] == "***0042"
    assert cert["PhotoURL"] is None
    assert data["visibility_profile"]["profile"] == "GUEST_DEMO"

    sessions = client.get("/sessions", headers=headers).json()
    rahul = next(s for s in sessions if s["student_id"] == "***0042")
    assert rahul["student_name"] == "R*** S***"
    assert rahul["confidence"] is None
    assert rahul["confidence_bucket"] == "High (≥85%)"
    assert rahul["visibility_profile"]["profile"] == "GUEST_DEMO"


def test_auditor_post_exam_review_context():
    headers = {
        "X-Viewer-Role": "auditor",
        "X-Viewer-Intent": "post_exam_review",
        "X-Viewer-Context": "exam_closed",
    }
    response = client.get("/digilocker/fetch/JEE25BPL0042", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["visibility_profile"]["profile"] == "AUDITOR_COMPLIANCE"
    assert data["document"]["IssuedTo"]["Person"]["name"] == "Rahul Sharma"
    assert data["visibility_profile"]["field_rules"]["live_webcam"] == "HIDDEN"


def test_mismatched_intent_triggers_defensive_minimization():
    headers = {
        "X-Viewer-Role": "invigilator",
        "X-Viewer-Intent": "post_exam_review",
        "X-Viewer-Context": "exam_in_progress",
    }
    response = client.get("/digilocker/fetch/JEE25BPL0042", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["visibility_profile"]["profile"] == "MISMATCHED_INTENT"
    assert data["visibility_profile"]["is_mismatched"] is True
    assert "Contextual mismatch" in data["visibility_profile"]["reason"]
    assert data["document"]["IssuedTo"]["Person"]["name"] == "R*** S***"


def test_context_session_registration_and_audit_logging():
    response = client.post(
        "/context/session",
        json={
            "role": "guest_demo",
            "intent": "demo_walkthrough",
            "context": "exam_in_progress",
            "screen": "verify",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["context"]["role"] == "guest_demo"
    assert "candidate_name" in payload["visibility_profile"]["fields_redacted"]

    audit_events = client.get("/audit?event_type=ACCESS_DECISION").json()
    assert len(audit_events) > 0
    assert any(e["action"] == "ACCESS_DECISION" for e in audit_events)


def test_get_context_rules():
    response = client.get("/context/rules")
    assert response.status_code == 200
    rules = response.json()
    assert "roles" in rules
    assert "intents" in rules
    assert "matrix_definition" in rules
    assert len(rules["matrix_definition"]) >= 4


def test_flagged_verification_is_persisted():
    response = client.post(
        "/verify/complete",
        json={
            "student_id": "JEE25BPL0103",
            "session_id": "SES_TEST_FLAG",
            "confidence": 61.3,
            "status": "FAILED",
            "center_id": "MANIT_BPL_04",
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "FLAGGED"
    assert "LOW_CONFIDENCE" in response.json()["flags"]

    sessions = client.get("/sessions").json()
    saved = next(item for item in sessions if item["id"] == "SES_TEST_FLAG")
    assert saved["status"] == "FLAGGED"
