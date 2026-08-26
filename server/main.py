import os
import json
import hashlib
import uuid
import datetime
import asyncio
import logging
import tempfile
from typing import List, Optional, Dict

from fastapi import (
    FastAPI, Depends, HTTPException, Header,
    WebSocket, BackgroundTasks, UploadFile, File, Form
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
from database import SessionLocal, engine
import clustering
import ai_pipeline  # noqa: F401 — imported here so both models load at server startup

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables (new columns/tables in models.py will appear on a fresh DB;
# for an existing DB delete classroom.db to reset, or use Alembic migrations).
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Whisper Slate Local Sync Server")

# Allow CORS for local network development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Rate limiting (in-memory token bucket for MVP)
# Maps device_token -> { 'count': int, 'reset_time': datetime }
# ---------------------------------------------------------------------------
RATE_LIMIT_STORE: Dict[str, dict] = {}
RATE_LIMIT_MAX = 5  # 5 doubts per minute


def check_rate_limit(device_token: str):
    """Raises HTTP 429 if the device has exceeded the rate limit."""
    now = datetime.datetime.utcnow()
    record = RATE_LIMIT_STORE.get(device_token)

    if not record or now > record['reset_time']:
        RATE_LIMIT_STORE[device_token] = {
            'count': 1,
            'reset_time': now + datetime.timedelta(minutes=1)
        }
        return

    if record['count'] >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute.")

    record['count'] += 1


# ---------------------------------------------------------------------------
# WebSocket managers
# ---------------------------------------------------------------------------

class DashboardConnectionManager:
    """Broadcasts cluster updates to all connected teacher dashboards."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception:
                pass


class DeviceChannelManager:
    """
    Per-device notification channel.  Each WebSocket is keyed by doubt_id so
    that a single review decision can be pushed to the exact student that
    submitted it.  No student can observe another student's channel — the
    doubt_id is an opaque server-generated integer, not a predictable identifier.
    """

    def __init__(self):
        self._channels: Dict[str, WebSocket] = {}

    async def connect(self, doubt_id: str, websocket: WebSocket):
        await websocket.accept()
        self._channels[doubt_id] = websocket

    def disconnect(self, doubt_id: str):
        self._channels.pop(doubt_id, None)

    async def send_to_device(self, doubt_id: str, data: dict):
        ws = self._channels.get(doubt_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(doubt_id)


dashboard_manager = DashboardConnectionManager()
device_manager = DeviceChannelManager()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class JoinRequest(BaseModel):
    classCode: str


class JoinResponse(BaseModel):
    device_token: str


class SessionStartRequest(BaseModel):
    topics: Optional[List[str]] = None  # free-text topic phrases from the teacher


class SessionStartResponse(BaseModel):
    sessionCode: str


class AudioDoubtResponse(BaseModel):
    doubtId: str
    status: str


class ReviewRequest(BaseModel):
    decision: str                        # "accept" | "reject"
    reason: Optional[str] = None         # "Inappropriate" | "Off-topic" | "Spam" | "Other"
    replyText: Optional[str] = None      # optional message shown to the student
    penaltyMinutes: Optional[int] = None # 0 = no penalty; 9999 = rest of session sentinel


# ---------------------------------------------------------------------------
# Helper: build dashboard broadcast payload
# ---------------------------------------------------------------------------

def generate_dashboard_payload(session_code: str, db: Session) -> dict:
    # Only ACCEPTED doubts feed the ranked cluster view (§13.2 step 7).
    accepted_doubts_orm = (
        db.query(models.Doubt)
        .filter(
            models.Doubt.session_code == session_code,
            models.Doubt.status == "accepted",
        )
        .all()
    )
    doubts = [
        {
            'id': d.id,
            'text': d.text,
            'embedding': d.get_embedding(),
            'timestamp': d.timestamp,
        }
        for d in accepted_doubts_orm
    ]

    clusters = clustering.compute_clusters(doubts)

    # Timeline counts all doubts in session regardless of status (volume overview)
    all_doubts_orm = (
        db.query(models.Doubt)
        .filter(models.Doubt.session_code == session_code)
        .all()
    )
    time_counts: Dict[str, int] = {}
    for d in all_doubts_orm:
        minute = d.timestamp.replace(second=0, microsecond=0).isoformat()
        time_counts[minute] = time_counts.get(minute, 0) + 1
    global_timeline = [{"time": k, "count": v} for k, v in sorted(time_counts.items())]

    # Pending count for the badge — doubts awaiting teacher review
    pending_count = sum(1 for d in all_doubts_orm if d.status == "pending_review")

    devices_orm = (
        db.query(models.Device)
        .filter(models.Device.session_code == session_code)
        .all()
    )
    devices = [
        {"id": d.token_hash[:8], "full_token": "hidden", "is_blocked": d.is_blocked}
        for d in devices_orm
    ]

    return {
        "type": "CLUSTER_UPDATE",
        "sessionCode": session_code,
        "clusters": clusters,
        "global_timeline": global_timeline,
        "devices": devices,
        "pending_count": pending_count,
    }


async def recluster_and_broadcast(session_code: str):
    db = SessionLocal()
    try:
        payload = generate_dashboard_payload(session_code, db)
        await dashboard_manager.broadcast_json(payload)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Background task: transcribe → delete audio → embed → screen → update DB → broadcast
# ---------------------------------------------------------------------------

async def process_audio_doubt(doubt_id: int, tmp_audio_path: str, session_code: str):
    """
    Full AI pipeline, runs asynchronously after POST /doubts/audio returns.

    Steps:
    1. Transcribe with faster-whisper.
    2. DELETE the temp audio file — raw audio never stored at rest (§13.2 step 3).
    3. Embed the transcript with sentence-transformers.
    4. Appropriateness screening (better-profanity) — advisory flag only.
    5. Relevance scoring (cosine sim vs session topics) — advisory flag only.
    6. Update Doubt row to status="pending_review" with all flags/scores.
    7. Broadcast cluster update to teacher dashboard.
    8. Notify the student device that processing is complete.
    """
    db = SessionLocal()
    try:
        # --- Step 1: Transcribe ---
        logger.info("Transcribing doubt %s from %s", doubt_id, tmp_audio_path)
        try:
            transcript = ai_pipeline.transcribe(tmp_audio_path)
        except Exception as exc:
            logger.error("Transcription failed for doubt %s: %s", doubt_id, exc)
            transcript = ""
        finally:
            # --- Step 2: Delete audio regardless of success/failure ---
            try:
                os.remove(tmp_audio_path)
                logger.info("Deleted temp audio: %s", tmp_audio_path)
            except FileNotFoundError:
                pass

        if not transcript:
            doubt = db.query(models.Doubt).filter(models.Doubt.id == doubt_id).first()
            if doubt:
                doubt.status = "pending_review"
                doubt.text = "[transcription failed]"
                db.commit()
            return

        # --- Step 3: Embed ---
        logger.info("Embedding doubt %s: %r", doubt_id, transcript[:80])
        embedding = ai_pipeline.embed(transcript)

        # --- Step 4: Appropriateness screening ---
        app_flagged, app_score = ai_pipeline.check_appropriateness(transcript)
        logger.info("Doubt %s appropriateness: flagged=%s score=%.2f", doubt_id, app_flagged, app_score)

        # --- Step 5: Relevance scoring ---
        session = db.query(models.Session).filter(models.Session.code == session_code).first()
        topic_embeddings = session.get_topic_embeddings() if session else []
        rel_score, rel_flagged = ai_pipeline.score_relevance(embedding, topic_embeddings)
        logger.info("Doubt %s relevance: score=%.3f flagged=%s", doubt_id, rel_score, rel_flagged)

        # --- Step 6: Update DB ---
        doubt = db.query(models.Doubt).filter(models.Doubt.id == doubt_id).first()
        if not doubt:
            logger.warning("Doubt %s not found in DB after transcription", doubt_id)
            return

        doubt.text = transcript
        doubt.set_embedding(embedding)
        doubt.status = "pending_review"
        doubt.appropriateness_flag = app_flagged
        doubt.appropriateness_score = app_score
        doubt.relevance_score = round(rel_score, 4)
        doubt.relevance_flag = rel_flagged
        db.commit()
        logger.info("Doubt %s ready for review", doubt_id)

        # --- Step 7: Broadcast ---
        await recluster_and_broadcast(session_code)

        # --- Step 8: Notify student ---
        await device_manager.send_to_device(
            str(doubt_id),
            {
                "type": "PROCESSING_COMPLETE",
                "doubtId": doubt_id,
                "status": "pending_review",
            },
        )

    finally:
        db.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/ping")
def ping():
    return {"status": "ok"}


@app.post("/session/join", response_model=JoinResponse)
def join_session(req: JoinRequest, db: Session = Depends(get_db)):
    device_token = str(uuid.uuid4())
    token_hash = hashlib.sha256(device_token.encode()).hexdigest()
    new_device = models.Device(token_hash=token_hash)
    db.add(new_device)
    db.commit()
    return {"device_token": device_token}


@app.post("/session/start", response_model=SessionStartResponse)
def start_session(req: SessionStartRequest = SessionStartRequest(), db: Session = Depends(get_db)):
    """
    Starts a new classroom session.

    Optional body: { "topics": ["recursion", "stack overflow", "base case"] }

    Each non-empty topic phrase is embedded with all-MiniLM-L6-v2 once here and
    stored on the Session row.  These embeddings are used as the topic reference set
    for relevance scoring of all doubts submitted during this session (§13.3, §14.3–14.4).
    """
    code = str(uuid.uuid4())[:6].upper()
    session = models.Session(code=code)

    # Embed topics if provided
    if req.topics:
        phrases = [t.strip() for t in req.topics if t.strip()]
        if phrases:
            topic_vecs = [ai_pipeline.embed(phrase) for phrase in phrases]
            session.set_topic_embeddings(topic_vecs)
            logger.info("Session %s: embedded %d topic phrase(s): %s", code, len(phrases), phrases)

    db.add(session)
    db.commit()
    return {"sessionCode": code}


@app.post("/session/stop")
def stop_session(sessionCode: str, db: Session = Depends(get_db)):
    session = db.query(models.Session).filter(models.Session.code == sessionCode).first()
    if session:
        session.is_active = False
        db.commit()
    return {"status": "stopped"}


@app.post("/devices/{device_token}/block")
def block_device(device_token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(device_token.encode()).hexdigest()
    device = db.query(models.Device).filter(models.Device.token_hash == token_hash).first()
    if device:
        device.is_blocked = True
        db.commit()
    return {"status": "blocked"}


@app.post("/devices/{device_token}/kick")
def kick_device(device_token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(device_token.encode()).hexdigest()
    device = db.query(models.Device).filter(models.Device.token_hash == token_hash).first()
    if device:
        db.delete(device)
        db.commit()
    return {"status": "kicked"}


@app.post("/doubts/audio", response_model=AudioDoubtResponse)
async def submit_audio_doubt(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(..., description="Raw audio from MediaRecorder (webm/opus or wav)"),
    sessionCode: str = Form(...),
    deviceToken: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Accepts raw audio from a student, creates a Doubt row with status="processing",
    and returns { doubtId, status: "processing" } immediately.

    Transcription, embedding, and pre-screening run in a BackgroundTask so this
    endpoint returns within milliseconds.
    """
    check_rate_limit(deviceToken)
    token_hash = hashlib.sha256(deviceToken.encode()).hexdigest()

    device = db.query(models.Device).filter(models.Device.token_hash == token_hash).first()
    if device and device.is_blocked:
        raise HTTPException(status_code=403, detail="Device is blocked.")

    if device:
        device.session_code = sessionCode
        device.last_seen = datetime.datetime.utcnow()
    else:
        device = models.Device(token_hash=token_hash, session_code=sessionCode)
        db.add(device)

    db_doubt = models.Doubt(
        text="",
        session_code=sessionCode,
        device_token_hash=token_hash,
        status="processing",
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(db_doubt)
    db.commit()
    db.refresh(db_doubt)

    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name
    finally:
        tmp.close()

    background_tasks.add_task(process_audio_doubt, db_doubt.id, tmp_path, sessionCode)

    return {"doubtId": str(db_doubt.id), "status": "processing"}


@app.get("/doubts/queue")
def get_moderation_queue(sessionCode: str, db: Session = Depends(get_db)):
    """
    Returns all doubts with status="pending_review" for the given session,
    ordered oldest-first (teacher works through the queue chronologically).
    Includes transcript, pre-screening flags/scores for each doubt.
    """
    doubts = (
        db.query(models.Doubt)
        .filter(
            models.Doubt.session_code == sessionCode,
            models.Doubt.status == "pending_review",
        )
        .order_by(models.Doubt.timestamp.asc())
        .all()
    )
    return {
        "sessionCode": sessionCode,
        "queue": [
            {
                "id": d.id,
                "text": d.text,
                "timestamp": d.timestamp.isoformat(),
                "appropriateness_flag": d.appropriateness_flag,
                "appropriateness_score": d.appropriateness_score,
                "relevance_score": d.relevance_score,
                "relevance_flag": d.relevance_flag,
            }
            for d in doubts
        ],
    }


@app.post("/doubts/{doubt_id}/review")
async def review_doubt(
    doubt_id: int,
    req: ReviewRequest,
    db: Session = Depends(get_db),
):
    """
    Teacher accepts or rejects a doubt from the moderation queue.

    On accept:   status → "accepted"; optional reply pushed to student device.
    On reject:   status → "rejected"; reason stored; optional penalty row created.
    Either way:  recluster_and_broadcast() fires so the cluster view updates instantly.

    Penalties are keyed to the device's opaque token hash, never to real identity (§13.3).
    penaltyMinutes=9999 is a sentinel for "rest of session".
    """
    doubt = db.query(models.Doubt).filter(models.Doubt.id == doubt_id).first()
    if not doubt:
        raise HTTPException(status_code=404, detail="Doubt not found.")
    if doubt.status not in ("pending_review", "processing"):
        raise HTTPException(status_code=409, detail=f"Doubt is already '{doubt.status}'.")

    if req.decision not in ("accept", "reject"):
        raise HTTPException(status_code=422, detail="decision must be 'accept' or 'reject'.")

    now = datetime.datetime.utcnow()

    if req.decision == "accept":
        doubt.status = "accepted"
    else:
        doubt.status = "rejected"
        doubt.review_reason = req.reason

        # Create penalty row if a duration was specified
        pm = req.penaltyMinutes or 0
        if pm > 0 and doubt.device_token_hash:
            penalty = models.Penalty(
                device_token_hash=doubt.device_token_hash,
                expires_at=now + datetime.timedelta(minutes=pm),
                reason=req.reason,
                doubt_id=doubt_id,
            )
            db.add(penalty)
            logger.info(
                "Penalty created: device=%s…, minutes=%d, expires=%s",
                doubt.device_token_hash[:8], pm, penalty.expires_at.isoformat()
            )

    db.commit()

    # Push decision to student's per-device WS channel
    penalty_seconds = (req.penaltyMinutes or 0) * 60
    await device_manager.send_to_device(
        str(doubt_id),
        {
            "type": "REVIEW_DECISION",
            "doubtId": doubt_id,
            "status": "accepted" if req.decision == "accept" else "rejected",
            "replyMessage": req.replyText or None,
            "penaltySeconds": penalty_seconds if req.decision == "reject" else 0,
        },
    )

    # Recluster & broadcast so the teacher dashboard cluster view refreshes
    await recluster_and_broadcast(doubt.session_code)

    return {"status": "ok", "doubtId": doubt_id, "decision": req.decision}


@app.get("/clusters")
def get_clusters(sessionCode: str, db: Session = Depends(get_db)):
    payload = generate_dashboard_payload(sessionCode, db)
    return payload


# ---------------------------------------------------------------------------
# WebSocket: teacher dashboard broadcast channel
# ---------------------------------------------------------------------------

@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    await dashboard_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        dashboard_manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# WebSocket: per-device channel (student awaits review decision)
# ---------------------------------------------------------------------------

@app.websocket("/ws/device/{doubt_id}")
async def websocket_device_channel(doubt_id: str, websocket: WebSocket):
    await device_manager.connect(doubt_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        device_manager.disconnect(doubt_id)
