from __future__ import annotations

import datetime as dt
import os
import sqlite3
import time
from copy import deepcopy
from contextlib import closing
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.getenv("EXAMVERIFY_DB", BASE_DIR / "examverify.db"))
CENTER_ID = "MANIT_BPL_04"

app = FastAPI(
    title="ExamVerify API",
    version="2.0.0",
    description="DigiLocker-ready exam identity verification sandbox API with Context-Aware Privacy Control.",
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

# Roles, Intents, Contexts
ROLE_LABELS = {
    "invigilator": "Invigilator",
    "auditor": "Auditor / Reviewer",
    "guest_demo": "Guest / Demo",
}

INTENT_LABELS = {
    "live_verification": "Live Verification",
    "post_exam_review": "Post-Exam Review",
    "spot_check": "Spot Check",
    "demo_walkthrough": "Demo Walkthrough",
}

CONTEXT_LABELS = {
    "exam_in_progress": "Exam In Progress (Active Window)",
    "exam_closed": "Exam Closed (Post-Exam Window)",
}

ACTIVE_STATE = {
    "role": "invigilator",
    "intent": "live_verification",
    "context": "exam_in_progress",
    "screen": "verify",
}


class VerifyPayload(BaseModel):
    student_id: str = Field(min_length=3, max_length=40)
    session_id: str = Field(min_length=3, max_length=100)
    confidence: float = Field(ge=0, le=100)
    status: str
    center_id: str


class ContextPayload(BaseModel):
    role: str = "invigilator"
    intent: str = "live_verification"
    context: str = "exam_in_progress"
    screen: str = "verify"


def normalize_role(value: str | None) -> str:
    val = (value or ACTIVE_STATE["role"]).strip().lower()
    if val in {"guest", "guest_demo", "demo"}:
        return "guest_demo"
    return val if val in ROLE_LABELS else "guest_demo"


def normalize_intent(value: str | None) -> str:
    val = (value or ACTIVE_STATE["intent"]).strip().lower()
    return val if val in INTENT_LABELS else "demo_walkthrough"


def normalize_context(value: str | None) -> str:
    val = (value or ACTIVE_STATE["context"]).strip().lower()
    return val if val in CONTEXT_LABELS else "exam_in_progress"


def context_from_headers(
    x_viewer_role: str | None = Header(default=None, alias="X-Viewer-Role"),
    x_viewer_intent: str | None = Header(default=None, alias="X-Viewer-Intent"),
    x_viewer_context: str | None = Header(default=None, alias="X-Viewer-Context"),
    x_viewer_screen: str | None = Header(default=None, alias="X-Viewer-Screen"),
) -> dict:
    role = normalize_role(x_viewer_role)
    intent = normalize_intent(x_viewer_intent)
    ctx = normalize_context(x_viewer_context)
    screen = (x_viewer_screen or ACTIVE_STATE["screen"]).strip().lower() or "verify"
    return {
        "role": role,
        "role_label": ROLE_LABELS[role],
        "intent": intent,
        "intent_label": INTENT_LABELS[intent],
        "context": ctx,
        "context_label": CONTEXT_LABELS[ctx],
        "screen": screen,
    }


def mask_name(name: str) -> str:
    parts = name.split()
    masked = []
    for part in parts:
        if not part:
            continue
        masked.append(part[0] + "***")
    return " ".join(masked) or "R*** S***"


def mask_roll(roll: str) -> str:
    return f"***{roll[-4:]}" if len(roll) >= 4 else "***"


def mask_digilocker_id(value: str) -> str:
    parts = value.split("_")
    if len(parts) >= 3:
        return f"{parts[0]}_****_{parts[-1]}"
    return "DL_****"


def confidence_bucket(value: float) -> str:
    if value <= 0:
        return "Pending"
    if value >= 85:
        return "High (≥85%)"
    if value >= 60:
        return "Medium (60-84%)"
    return "Low (<60%)"


# Visibility Evaluation Engine based on PRD Section 6 Matrix: (Role x Intent x Context)
def evaluate_privacy_decision(
    context_data: dict,
    screen: str,
    requested_fields: list[str] | None = None,
) -> dict:
    role = context_data["role"]
    intent = context_data["intent"]
    ctx = context_data["context"]

    if requested_fields is None:
        requested_fields = [
            "candidate_name",
            "roll_number",
            "dob",
            "admit_photo",
            "live_webcam",
            "raw_confidence",
            "decision",
            "flag_reason_detail",
            "actor_identity",
            "digilocker_id",
        ]

    # Evaluate profile according to matrix
    is_mismatched = False
    mismatch_reason = ""

    if role == "invigilator":
        if intent == "live_verification" and ctx == "exam_in_progress":
            profile = "INVIGILATOR_LIVE"
            reason = "Invigilator conducting live gate checks during active exam window. Full operational visibility granted."
            field_rules = {
                "candidate_name": "FULL",
                "roll_number": "FULL",
                "dob": "FULL",
                "admit_photo": "FULL",
                "live_webcam": "FULL",
                "raw_confidence": "FULL",
                "decision": "FULL",
                "flag_reason_detail": "FULL",
                "actor_identity": "FULL",
                "digilocker_id": "FULL",
            }
        elif intent == "spot_check":
            profile = "INVIGILATOR_SPOT_CHECK"
            reason = "Invigilator spot-check mode: admit card and confidence score visible, raw credentials minimized."
            field_rules = {
                "candidate_name": "FULL",
                "roll_number": "FULL",
                "dob": "FULL",
                "admit_photo": "FULL",
                "live_webcam": "FULL",
                "raw_confidence": "FULL",
                "decision": "FULL",
                "flag_reason_detail": "FULL",
                "actor_identity": "FULL",
                "digilocker_id": "MASKED",
            }
        else:
            # Mismatched: e.g. post_exam_review during exam_in_progress, or demo_walkthrough
            is_mismatched = True
            profile = "MISMATCHED_INTENT"
            mismatch_reason = (
                f"Invigilator selected '{INTENT_LABELS.get(intent, intent)}' during '{CONTEXT_LABELS.get(ctx, ctx)}'. "
                "Contextual mismatch requires defensive data minimization."
            )
            reason = mismatch_reason
            field_rules = {
                "candidate_name": "MASKED",
                "roll_number": "MASKED",
                "dob": "MASKED",
                "admit_photo": "HIDDEN",
                "live_webcam": "HIDDEN",
                "raw_confidence": "BUCKETED",
                "decision": "FULL",
                "flag_reason_detail": "GENERIC",
                "actor_identity": "REDACTED",
                "digilocker_id": "MASKED",
            }

    elif role == "auditor":
        if intent in {"post_exam_review", "spot_check"}:
            profile = "AUDITOR_COMPLIANCE"
            reason = "Auditor conducting compliance review: candidate records & raw confidence full, live webcam stream disabled."
            field_rules = {
                "candidate_name": "FULL",
                "roll_number": "FULL",
                "dob": "FULL",
                "admit_photo": "FULL",
                "live_webcam": "HIDDEN",  # No live feed post-exam
                "raw_confidence": "FULL",
                "decision": "FULL",
                "flag_reason_detail": "FULL",
                "actor_identity": "FULL",
                "digilocker_id": "FULL",
            }
        else:
            # Mismatched e.g. live_verification
            is_mismatched = True
            profile = "MISMATCHED_INTENT"
            mismatch_reason = (
                f"Auditor selected '{INTENT_LABELS.get(intent, intent)}'. "
                "Auditors are restricted from live gate admission feeds; full compliance review required."
            )
            reason = mismatch_reason
            field_rules = {
                "candidate_name": "MASKED",
                "roll_number": "MASKED",
                "dob": "MASKED",
                "admit_photo": "HIDDEN",
                "live_webcam": "HIDDEN",
                "raw_confidence": "BUCKETED",
                "decision": "FULL",
                "flag_reason_detail": "GENERIC",
                "actor_identity": "REDACTED",
                "digilocker_id": "MASKED",
            }

    else:
        # Guest / Demo mode
        profile = "GUEST_DEMO"
        reason = "Guest / public demo context: PII masked, biometric photos blurred, confidence bucketed to preserve privacy."
        field_rules = {
            "candidate_name": "MASKED",
            "roll_number": "MASKED",
            "dob": "MASKED",
            "admit_photo": "BLURRED",
            "live_webcam": "HIDDEN",
            "raw_confidence": "BUCKETED",
            "decision": "FULL",
            "flag_reason_detail": "GENERIC",
            "actor_identity": "REDACTED",
            "digilocker_id": "MASKED",
        }

    fields_granted = [f for f in requested_fields if field_rules.get(f) == "FULL"]
    fields_redacted = [f for f in requested_fields if field_rules.get(f) in {"MASKED", "BLURRED", "HIDDEN", "BUCKETED", "GENERIC", "REDACTED"}]

    return {
        "profile": profile,
        "is_mismatched": is_mismatched,
        "mismatch_reason": mismatch_reason,
        "role": role,
        "role_label": ROLE_LABELS.get(role, role),
        "intent": intent,
        "intent_label": INTENT_LABELS.get(intent, intent),
        "context": ctx,
        "context_label": CONTEXT_LABELS.get(ctx, ctx),
        "screen": screen,
        "reason": reason,
        "field_rules": field_rules,
        "fields_granted": fields_granted,
        "fields_redacted": fields_redacted,
    }


def apply_document_privacy(document: dict, decision: dict) -> dict:
    redacted = deepcopy(document)
    person = redacted["IssuedTo"]["Person"]
    cert = redacted["CertificateData"]
    rules = decision["field_rules"]

    if rules.get("candidate_name") == "MASKED":
        person["name"] = mask_name(person["name"])
        person["name_is_masked"] = True
    if rules.get("dob") == "MASKED":
        person["dob"] = "**-**-" + person["dob"][-4:]
    if rules.get("roll_number") == "MASKED":
        cert["RollNumber"] = mask_roll(cert["RollNumber"])
        cert["roll_is_masked"] = True
    if rules.get("admit_photo") in {"BLURRED", "HIDDEN"}:
        cert["PhotoURL"] = None
        cert["PhotoRedacted"] = True
        cert["PhotoRedactionMode"] = rules.get("admit_photo")
    if rules.get("digilocker_id") == "MASKED":
        redacted["DigiLockerID"] = mask_digilocker_id(redacted["DigiLockerID"])

    redacted["visibility_profile"] = decision
    return redacted


def apply_session_privacy(row: sqlite3.Row, decision: dict) -> dict:
    item = dict(row)
    flags = [flag for flag in item["flags"].split(",") if flag]
    rules = decision["field_rules"]

    if rules.get("candidate_name") == "MASKED":
        item["student_name"] = mask_name(item["student_name"])
        item["name_masked"] = True
    if rules.get("roll_number") == "MASKED":
        item["student_id"] = mask_roll(item["student_id"])
        item["roll_masked"] = True
    if rules.get("raw_confidence") == "BUCKETED":
        item["confidence_bucket"] = confidence_bucket(item["confidence"])
        item["raw_confidence_hidden"] = True
        item["confidence"] = None
    if rules.get("flag_reason_detail") == "GENERIC" and flags:
        item["flags"] = ["UNDER_REVIEW"]
    else:
        item["flags"] = flags

    item["visibility_profile"] = decision
    return item


def apply_audit_privacy(row: sqlite3.Row, decision: dict) -> dict:
    item = dict(row)
    rules = decision["field_rules"]

    if rules.get("candidate_name") == "MASKED":
        item["student_name"] = mask_name(item["student_name"])
    if rules.get("roll_number") == "MASKED":
        item["student_id"] = mask_roll(item["student_id"])
    if rules.get("actor_identity") == "REDACTED":
        item["actor"] = "REDACTED_ACTOR"
    if rules.get("flag_reason_detail") == "GENERIC" and item["action"].startswith("FRAUD_FLAG"):
        item["action"] = "REVIEW_FLAG_REDACTED"

    item["visibility_profile"] = decision
    return item


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def log_event(
    conn: sqlite3.Connection,
    session_id: str,
    student_id: str,
    action: str,
    actor: str,
    severity: str,
    details: str = "",
) -> None:
    conn.execute(
        "INSERT INTO audit_log(session_id, student_id, action, actor, timestamp, severity, details) VALUES (?,?,?,?,?,?,?)",
        (session_id, student_id, action, actor, now_iso(), severity, details),
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
                severity TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT ''
            );
            """
        )
        # Check if details column exists in legacy db
        cols = [c[1] for c in conn.execute("PRAGMA table_info(audit_log)").fetchall()]
        if "details" not in cols:
            conn.execute("ALTER TABLE audit_log ADD COLUMN details TEXT NOT NULL DEFAULT ''")

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
        ("SES_DEMO_001", "JEE25BPL0042", "DIGILOCKER_FETCH_SUCCESS", "DIGILOCKER_API", "INFO", "Admit card fetched"),
        ("SES_DEMO_001", "JEE25BPL0042", "FACE_MATCH_VERIFIED", "AI_ENGINE", "SUCCESS", "Match 94.2%"),
        ("SES_DEMO_003", "JEE25BPL0103", "FACE_MATCH_FAILED", "AI_ENGINE", "WARNING", "Match 61.3%"),
        ("SES_DEMO_003", "JEE25BPL0103", "FRAUD_FLAG_MULTIPLE_ATTEMPTS", "FRAUD_ENGINE", "CRITICAL", "Multiple sessions flagged"),
        ("SES_DEMO_003", "JEE25BPL0103", "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL", "Escalated for physical verification"),
        ("SES_DEMO_005", "JEE25BPL0156", "CENTER_MISMATCH_DETECTED", "FRAUD_ENGINE", "CRITICAL", "Assigned MANIT_BPL_01"),
        ("SES_DEMO_005", "JEE25BPL0156", "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL", "Center mismatch alert"),
        ("SES_ACCESS_INIT", "-", "ACCESS_DECISION", "PRIVACY_ENGINE", "INFO", "Profile: INVIGILATOR_LIVE | Role: Invigilator | Granted: 10 fields"),
    ]
    for event in events:
        log_event(conn, *event)


init_db()


@app.get("/")
def root() -> dict:
    return {
        "name": "ExamVerify API",
        "version": "2.0.0",
        "feature": "Context-Aware Privacy Control for Prediction Engine",
        "status": "ready",
        "sandbox_mode": True,
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "database": str(DB_PATH.name), "privacy_engine": "active"}


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


@app.post("/context/session")
def set_context(payload: ContextPayload) -> dict:
    ACTIVE_STATE["role"] = normalize_role(payload.role)
    ACTIVE_STATE["intent"] = normalize_intent(payload.intent)
    ACTIVE_STATE["context"] = normalize_context(payload.context)
    ACTIVE_STATE["screen"] = payload.screen.strip().lower() or "verify"

    context_data = {
        "role": ACTIVE_STATE["role"],
        "role_label": ROLE_LABELS[ACTIVE_STATE["role"]],
        "intent": ACTIVE_STATE["intent"],
        "intent_label": INTENT_LABELS[ACTIVE_STATE["intent"]],
        "context": ACTIVE_STATE["context"],
        "context_label": CONTEXT_LABELS[ACTIVE_STATE["context"]],
        "screen": ACTIVE_STATE["screen"],
    }
    decision = evaluate_privacy_decision(context_data, ACTIVE_STATE["screen"])

    # Log access decision to append-only audit trail
    with closing(get_db()) as conn:
        details_msg = f"Profile: {decision['profile']} | Role: {decision['role_label']} | Intent: {decision['intent_label']} | Context: {decision['context_label']} | Redacted: {len(decision['fields_redacted'])} fields"
        log_event(conn, "CTX_SWITCH", "-", "ACCESS_DECISION", "PRIVACY_ENGINE", "INFO", details_msg)
        conn.commit()

    return {"context": context_data, "visibility_profile": decision}


@app.get("/context/session")
def get_context(context_data: dict = Depends(context_from_headers)) -> dict:
    decision = evaluate_privacy_decision(context_data, context_data["screen"])
    return {"context": context_data, "visibility_profile": decision}


@app.get("/context/rules")
def get_context_rules() -> dict:
    return {
        "roles": ROLE_LABELS,
        "intents": INTENT_LABELS,
        "contexts": CONTEXT_LABELS,
        "matrix_definition": [
            {
                "combination": "Invigilator + Live Verification (Exam in Progress)",
                "role": "invigilator",
                "intent": "live_verification",
                "context": "exam_in_progress",
                "profile": "INVIGILATOR_LIVE",
                "candidate_name": "Full",
                "roll_number": "Full",
                "admit_photo": "Shown (needed for live match)",
                "live_webcam": "Shown (local only)",
                "raw_confidence": "Full precision (e.g. 94.2%)",
                "decision": "Full (VERIFIED / FLAGGED)",
                "flag_reason_detail": "Full (Low confidence, Multiple attempts)",
                "actor_identity": "Full (AI_ENGINE, FRAUD_ENGINE)",
                "justification": "Invigilator conducting live gate verification during active exam requires operational biometric visibility.",
            },
            {
                "combination": "Auditor + Post-Exam Review (Exam Closed)",
                "role": "auditor",
                "intent": "post_exam_review",
                "context": "exam_closed",
                "profile": "AUDITOR_COMPLIANCE",
                "candidate_name": "Full",
                "roll_number": "Full",
                "admit_photo": "Shown",
                "live_webcam": "Not applicable (no live stream post-exam)",
                "raw_confidence": "Full precision (e.g. 94.2%)",
                "decision": "Full",
                "flag_reason_detail": "Full",
                "actor_identity": "Full",
                "justification": "Auditor conducting post-exam compliance review has legitimate need-to-know for historic records.",
            },
            {
                "combination": "Guest / Public Demo (Demo Walkthrough)",
                "role": "guest_demo",
                "intent": "demo_walkthrough",
                "context": "exam_in_progress",
                "profile": "GUEST_DEMO",
                "candidate_name": "Masked (R*** S***)",
                "roll_number": "Masked (***0042)",
                "admit_photo": "Blurred / Privacy Placeholder",
                "live_webcam": "Never shown (Privacy Protected)",
                "raw_confidence": "Bucketed only (High / Medium / Low)",
                "decision": "Full (Decision itself is not sensitive)",
                "flag_reason_detail": "Generic (Under review)",
                "actor_identity": "Redacted (REDACTED_ACTOR)",
                "justification": "Public demo viewers inspect workflow mechanics without accessing real candidate identity or exact scores.",
            },
            {
                "combination": "Any Role + Mismatched Context / Intent",
                "role": "any_mismatched",
                "intent": "mismatched",
                "context": "any",
                "profile": "MISMATCHED_INTENT",
                "candidate_name": "Masked + Reason Shown",
                "roll_number": "Masked + Reason Shown",
                "admit_photo": "Hidden",
                "live_webcam": "Hidden",
                "raw_confidence": "Bucketed",
                "decision": "Full",
                "flag_reason_detail": "Generic (Under review)",
                "actor_identity": "Redacted",
                "justification": "Role and stated intent do not match current operational window; defensive data minimization applied.",
            },
        ],
    }


@app.get("/digilocker/fetch/{roll_number}")
def fetch_from_digilocker(roll_number: str, context_data: dict = Depends(context_from_headers)) -> dict:
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
    decision = evaluate_privacy_decision(
        context_data,
        "verify",
        ["candidate_name", "roll_number", "dob", "admit_photo", "live_webcam", "digilocker_id"],
    )

    with closing(get_db()) as conn:
        log_event(conn, session_id, normalized, "DIGILOCKER_FETCH_SUCCESS", "DIGILOCKER_API", "INFO", "Admit card retrieved")
        details_msg = f"Profile: {decision['profile']} | Role: {decision['role_label']} | Redacted: {', '.join(decision['fields_redacted']) or 'None'}"
        log_event(conn, session_id, normalized, "ACCESS_DECISION", "PRIVACY_ENGINE", "INFO", details_msg)
        conn.commit()

    return {
        "status": "SUCCESS",
        "session_id": session_id,
        "response_time_ms": round((time.perf_counter() - started) * 1000),
        "api_version": "sandbox-v3.0",
        "source": "digilocker.gov.in",
        "sandbox_mode": True,
        "visibility_profile": decision,
        "privacy_decision": decision,  # alias for backwards compatibility
        "document": apply_document_privacy(DIGILOCKER_DB[normalized], decision),
    }


@app.post("/verify/complete")
def complete_verification(payload: VerifyPayload, context_data: dict = Depends(context_from_headers)) -> dict:
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
        log_event(conn, payload.session_id, payload.student_id, action, "AI_ENGINE", severity, f"Confidence: {payload.confidence}%")
        for flag in dict.fromkeys(flags):
            log_event(conn, payload.session_id, payload.student_id, f"FRAUD_FLAG_{flag}", "FRAUD_ENGINE", "CRITICAL", "Anomaly detected")
        if not is_verified:
            log_event(conn, payload.session_id, payload.student_id, "INVIGILATOR_ALERTED", "SYSTEM", "CRITICAL", "Manual review required")

        decision = evaluate_privacy_decision(
            context_data,
            "verify",
            ["candidate_name", "roll_number", "raw_confidence", "decision", "flag_reason_detail"],
        )
        details_msg = f"Profile: {decision['profile']} | Status: {status} | Score: {payload.confidence}%"
        log_event(conn, payload.session_id, payload.student_id, "ACCESS_DECISION", "PRIVACY_ENGINE", "INFO", details_msg)
        conn.commit()

    return {
        "ok": True,
        "session_id": payload.session_id,
        "status": status,
        "flags": list(dict.fromkeys(flags)),
        "visibility_profile": decision,
        "privacy_decision": decision,
    }


@app.get("/sessions")
def get_sessions(context_data: dict = Depends(context_from_headers)) -> list[dict]:
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY CASE WHEN display_time='--' THEN 1 ELSE 0 END, display_time DESC"
        ).fetchall()

    decision = evaluate_privacy_decision(
        context_data,
        "dashboard",
        ["candidate_name", "roll_number", "raw_confidence", "flag_reason_detail"],
    )
    return [apply_session_privacy(row, decision) for row in rows]


@app.get("/audit")
def get_audit(
    event_type: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    context_data: dict = Depends(context_from_headers),
) -> list[dict]:
    with closing(get_db()) as conn:
        query = """
            SELECT a.*, COALESCE(s.student_name, a.student_id) AS student_name
            FROM audit_log a
            LEFT JOIN sessions s ON s.id = a.session_id
        """
        params = []
        conditions = []

        if event_type:
            event_type_norm = event_type.strip().upper()
            if event_type_norm == "ACCESS_DECISION":
                conditions.append("a.action = 'ACCESS_DECISION'")
            elif event_type_norm == "OPERATIONAL":
                conditions.append("a.action != 'ACCESS_DECISION'")

        if severity and severity.strip().upper() != "ALL":
            conditions.append("a.severity = ?")
            params.append(severity.strip().upper())

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY a.id DESC LIMIT 300"
        rows = conn.execute(query, params).fetchall()

    decision = evaluate_privacy_decision(
        context_data,
        "audit",
        ["candidate_name", "roll_number", "flag_reason_detail", "actor_identity"],
    )
    return [apply_audit_privacy(row, decision) for row in rows]


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
        privacy_events = conn.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='ACCESS_DECISION'"
        ).fetchone()[0]

    return {
        "total": total,
        "verified": verified,
        "flagged": flagged,
        "pending": pending,
        "average_confidence": round(average, 1),
        "access_decisions_logged": privacy_events,
    }
