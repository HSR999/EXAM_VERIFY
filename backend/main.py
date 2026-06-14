from __future__ import annotations

import datetime as dt
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("EXAMVERIFY_DB", BASE_DIR / "examverify.db"))
CENTER_ID = "MANIT_BPL_04"

app = FastAPI(
    title="ExamVerify API",
    version="1.0.0",
    description="DigiLocker-ready exam identity verification sandbox API.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


DIGILOCKER_DB = {
    "JEE25BPL0042": {
        "issuer": "National Testing Agency",
        "doctype": "AdmitCard",
        "IssuedTo": {"Person": {"name": "Rahul Sharma", "dob": "15-03-2005", "gender": "M"}},
        "CertificateData": {
            "RollNumber": "JEE25BPL0042",
            "ExamName": "JEE Mains 2025",
            "ExamCenter": "MANIT Bhopal - Center 04",
            "CenterCode": CENTER_ID,
            "ExamDate": "22-01-2025",
            "PhotoURL": "https://i.pravatar.cc/300?img=11",
        },
        "DigiLockerID": "DL_2024_JEE_0042",
        "IssuedOn": "2025-01-01",
        "ValidUntil": "2025-01-22",
        "source": "digilocker.gov.in",
        "verified": True,
    },
    "JEE25BPL0087": {
        "issuer": "National Testing Agency",
        "doctype": "AdmitCard",
        "IssuedTo": {"Person": {"name": "Priya Verma", "dob": "22-07-2005", "gender": "F"}},
        "CertificateData": {
            "RollNumber": "JEE25BPL0087",
            "ExamName": "JEE Mains 2025",
            "ExamCenter": "MANIT Bhopal - Center 04",
            "CenterCode": CENTER_ID,
            "ExamDate": "22-01-2025",
            "PhotoURL": "https://i.pravatar.cc/300?img=5",
        },
        "DigiLockerID": "DL_2024_JEE_0087",
        "IssuedOn": "2025-01-01",
        "ValidUntil": "2025-01-22",
        "source": "digilocker.gov.in",
        "verified": True,
    },
    "JEE25BPL0103": {
        "issuer": "National Testing Agency",
        "doctype": "AdmitCard",
        "IssuedTo": {"Person": {"name": "Amit Patel", "dob": "08-11-2004", "gender": "M"}},
        "CertificateData": {
            "RollNumber": "JEE25BPL0103",
            "ExamName": "JEE Mains 2025",
            "ExamCenter": "MANIT Bhopal - Center 04",
            "CenterCode": CENTER_ID,
            "ExamDate": "22-01-2025",
            "PhotoURL": "https://i.pravatar.cc/300?img=3",
        },
        "DigiLockerID": "DL_2024_JEE_0103",
        "IssuedOn": "2025-01-01",
        "ValidUntil": "2025-01-22",
        "source": "digilocker.gov.in",
        "verified": True,
    },
}

SEED_SESSIONS = [
    ("SES_DEMO_001", "JEE25BPL0042", "Rahul Sharma", "VERIFIED", 94.2, "09:02", ""),
    ("SES_DEMO_002", "JEE25BPL0087", "Priya Verma", "VERIFIED", 91.7, "09:04", ""),
    ("SES_DEMO_003", "JEE25BPL0103", "Amit Patel", "FLAGGED", 61.3, "09:06", "LOW_CONFIDENCE,MULTIPLE_ATTEMPTS"),
    ("SES_DEMO_004", "JEE25BPL0134", "Sneha Joshi", "VERIFIED", 96.1, "09:08", ""),
    ("SES_DEMO_005", "JEE25BPL0156", "Rohan Mishra", "FLAGGED", 44.8, "09:09", "CENTER_MISMATCH"),
    ("SES_DEMO_006", "JEE25BPL0178", "Kavya Singh", "VERIFIED", 89.5, "09:11", ""),
    ("SES_DEMO_007", "JEE25BPL0199", "Dev Gupta", "PENDING", 0.0, "--", ""),
    ("SES_DEMO_008", "JEE25BPL0211", "Ananya Rao", "PENDING", 0.0, "--", ""),
]


class VerifyPayload(BaseModel):
    student_id: str = Field(min_length=3, max_length=40)
    session_id: str = Field(min_length=3, max_length=100)
    confidence: float = Field(ge=0, le=100)
    status: str
    center_id: str


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def log_event(conn: sqlite3.Connection, session_id: str, student_id: str, action: str, actor: str, severity: str) -> None:
    conn.execute(
        "INSERT INTO audit_log(session_id, student_id, action, actor, timestamp, severity) VALUES (?,?,?,?,?,?)",
        (session_id, student_id, action, actor, now_iso(), severity),
    )


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(get_db()) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                center_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                display_time TEXT NOT NULL,
                status TEXT NOT NULL,
                confidence REAL NOT NULL,
                flags TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                severity TEXT NOT NULL
            );
            """
        )
        count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        if count == 0:
            for session_id, roll, name, status, confidence, display_time, flags in SEED_SESSIONS:
                conn.execute(
                    "INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?)",
                    (session_id, roll, name, CENTER_ID, now_iso(), display_time, status, confidence, flags),
                )
            seed_audit(conn)
        conn.commit()


def seed_audit(conn: sqlite3.Connection) -> None:
    events = [
        ("SES_DEMO_001", "JEE25BPL0042", "DIGILOCKER_FETCH_SUCCESS", "DIGILOCKER_API", "INFO"),
        ("SES_DEMO_001", "JEE25BPL0042", "FACE_MATCH_VERIFIED", "AI_ENGINE", "SUCCESS"),
        ("SES_DEMO_003", "JEE25BPL0103", "FACE_MATCH_FAILED", "AI_ENGINE", "WARNING"),
        ("SES_DEMO_003", "JEE25BPL0103", "FRAUD_FLAG_MULTIPLE_ATTEMPTS", "FRAUD_ENGINE", "CRITICAL"),
        ("SES_DEMO_003", "JEE25BPL0103", "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL"),
        ("SES_DEMO_005", "JEE25BPL0156", "CENTER_MISMATCH_DETECTED", "FRAUD_ENGINE", "CRITICAL"),
        ("SES_DEMO_005", "JEE25BPL0156", "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL"),
    ]
    for event in events:
        log_event(conn, *event)


init_db()


@app.get("/")
def root() -> dict:
    return {"name": "ExamVerify API", "status": "ready", "sandbox_mode": True}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "database": str(DB_PATH.name)}


@app.get("/digilocker/auth/status")
def digilocker_auth_status() -> dict:
    return {
        "connected": True,
        "auth_type": "OAuth 2.0",
        "scope": "admitcard.read profile.read",
        "issuer_verified": ["National Testing Agency", "CBSE", "CISCE"],
        "sandbox_mode": True,
        "production_endpoint": "https://api.digitallocker.gov.in/public/oauth2/1/",
        "note": "DigiLocker-compatible sandbox response. Production credentials require approval.",
    }


@app.get("/digilocker/fetch/{roll_number}")
def fetch_from_digilocker(roll_number: str) -> dict:
    normalized = roll_number.strip().upper()
    started = time.perf_counter()
    time.sleep(0.35)
    if normalized not in DIGILOCKER_DB:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "DOCUMENT_NOT_FOUND",
                "message": "No admit card found for this roll number in DigiLocker sandbox.",
                "source": "digilocker.gov.in",
            },
        )

    session_id = f"SES_{normalized}_{int(time.time() * 1000)}"
    with closing(get_db()) as conn:
        log_event(conn, session_id, normalized, "DIGILOCKER_FETCH_SUCCESS", "DIGILOCKER_API", "INFO")
        conn.commit()

    return {
        "status": "SUCCESS",
        "session_id": session_id,
        "response_time_ms": round((time.perf_counter() - started) * 1000),
        "api_version": "sandbox-v3.0",
        "source": "digilocker.gov.in",
        "sandbox_mode": True,
        "document": DIGILOCKER_DB[normalized],
    }


@app.post("/verify/complete")
def complete_verification(payload: VerifyPayload) -> dict:
    normalized_status = payload.status.upper()
    is_verified = normalized_status == "VERIFIED" and payload.confidence >= 85
    status = "VERIFIED" if is_verified else "FLAGGED"
    flags = [] if is_verified else ["LOW_CONFIDENCE"]
    if payload.student_id.upper() == "JEE25BPL0103":
        flags.append("MULTIPLE_ATTEMPTS")

    doc = DIGILOCKER_DB.get(payload.student_id.upper(), {})
    name = doc.get("IssuedTo", {}).get("Person", {}).get("name", payload.student_id)
    display_time = dt.datetime.now().strftime("%H:%M")

    with closing(get_db()) as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sessions
            (id, student_id, student_name, center_id, timestamp, display_time, status, confidence, flags)
            VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                payload.session_id,
                payload.student_id.upper(),
                name,
                payload.center_id,
                now_iso(),
                display_time,
                status,
                payload.confidence,
                ",".join(dict.fromkeys(flags)),
            ),
        )
        severity = "SUCCESS" if is_verified else "CRITICAL"
        action = "FACE_MATCH_VERIFIED" if is_verified else "FACE_MATCH_FAILED"
        log_event(conn, payload.session_id, payload.student_id, action, "AI_ENGINE", severity)
        for flag in dict.fromkeys(flags):
            log_event(conn, payload.session_id, payload.student_id, f"FRAUD_FLAG_{flag}", "FRAUD_ENGINE", "CRITICAL")
        if not is_verified:
            log_event(conn, payload.session_id, payload.student_id, "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL")
        conn.commit()
    return {"ok": True, "session_id": payload.session_id, "status": status, "flags": list(dict.fromkeys(flags))}


@app.get("/sessions")
def get_sessions() -> list[dict]:
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY CASE WHEN display_time='--' THEN 1 ELSE 0 END, display_time DESC"
        ).fetchall()
    return [
        {
            **dict(row),
            "flags": [flag for flag in row["flags"].split(",") if flag],
        }
        for row in rows
    ]


@app.get("/audit")
def get_audit() -> list[dict]:
    with closing(get_db()) as conn:
        rows = conn.execute(
            """
            SELECT a.*, COALESCE(s.student_name, a.student_id) AS student_name
            FROM audit_log a
            LEFT JOIN sessions s ON s.id = a.session_id
            ORDER BY a.id DESC
            LIMIT 250
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/stats")
def get_stats() -> dict:
    with closing(get_db()) as conn:
        total = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        verified = conn.execute("SELECT COUNT(*) FROM sessions WHERE status='VERIFIED'").fetchone()[0]
        flagged = conn.execute("SELECT COUNT(*) FROM sessions WHERE status='FLAGGED'").fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM sessions WHERE status='PENDING'").fetchone()[0]
        average = conn.execute(
            "SELECT COALESCE(AVG(confidence), 0) FROM sessions WHERE confidence > 0"
        ).fetchone()[0]
    return {
        "total": total,
        "verified": verified,
        "flagged": flagged,
        "pending": pending,
        "average_confidence": round(average, 1),
    }

