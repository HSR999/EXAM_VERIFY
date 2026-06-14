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


def test_digilocker_success_and_missing_document():
    response = client.get("/digilocker/fetch/JEE25BPL0042")
    assert response.status_code == 200
    assert response.json()["document"]["CertificateData"]["RollNumber"] == "JEE25BPL0042"
    assert response.json()["sandbox_mode"] is True

    missing = client.get("/digilocker/fetch/UNKNOWN")
    assert missing.status_code == 404


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

