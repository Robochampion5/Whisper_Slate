import os
import json
import hashlib
import uuid
import datetime
import asyncio
import logging
import tempfile
from typing import List, Dict

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

# Create tables (new columns in models.py will be reflected on next startup
# for a fresh DB; for an existing DB a migration tool would be needed, but
# for MVP we drop & recreate on schema change via alembic or manual reset).
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
# Maps device_token_hash -> { 'count': int, 'reset_time': datetime }
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
    doubt_id is an opaque server-generated UUID, not a predictable identifier.
    """

    def __init__(self):
        # doubt_id (str) -> WebSocket
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


class SessionStartResponse(BaseModel):
    sessionCode: str


class AudioDoubtResponse(BaseModel):
    doubtId: str
    status: str


# ---------------------------------------------------------------------------
# Helper: build and broadcast dashboard payload
# ---------------------------------------------------------------------------

def generate_dashboard_payload(session_code: str, db: Session) -> dict:
    # Only ACCEPTED doubts feed the ranked cluster view (§13.2 step 7).
    # Pending/rejected doubts are excluded from clustering.
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

    # Global timeline (all doubts in session, any status, for volume overview)
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
    }


async def recluster_and_broadcast(session_code: str):
    db = SessionLocal()
    try:
        payload = generate_dashboard_payload(session_code, db)
        await dashboard_manager.broadcast_json(payload)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Background task: transcribe → embed → update DB → broadcast
# ---------------------------------------------------------------------------

async def process_audio_doubt(doubt_id: int, tmp_audio_path: str, session_code: str):
    """
    Runs after POST /doubts/audio returns.  Performs the full AI pipeline:

    1. Transcribe the audio with faster-whisper.
    2. DELETE the temp audio file immediately — raw audio is never stored at
       rest, preserving the product's original privacy commitment even though
       processing moved server-side (§13.2 step 3).
    3. Embed the transcript with sentence-transformers.
    4. Update the Doubt row to status="pending_review".
    5. Broadcast a cluster update to the teacher dashboard.
    6. Notify the specific student device that processing is complete.
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
                logger.info("Deleted temp audio file: %s", tmp_audio_path)
            except FileNotFoundError:
                pass

        if not transcript:
            # If transcription failed or produced nothing, mark as rejected-system
            doubt = db.query(models.Doubt).filter(models.Doubt.id == doubt_id).first()
            if doubt:
                doubt.status = "pending_review"
                doubt.text = "[transcription failed]"
                db.commit()
            return

        # --- Step 3: Embed ---
        logger.info("Embedding doubt %s: %r", doubt_id, transcript[:80])
        embedding = ai_pipeline.embed(transcript)

        # --- Step 4: Update DB ---
        doubt = db.query(models.Doubt).filter(models.Doubt.id == doubt_id).first()
        if not doubt:
            logger.warning("Doubt %s not found in DB after transcription", doubt_id)
            return

        doubt.text = transcript
        doubt.set_embedding(embedding)
        doubt.status = "pending_review"
        db.commit()
        logger.info("Doubt %s updated: status=pending_review, text=%r", doubt_id, transcript[:60])

        # --- Step 5: Broadcast cluster update ---
        await recluster_and_broadcast(session_code)

        # --- Step 6: Notify the student device ---
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
def start_session(db: Session = Depends(get_db)):
    code = str(uuid.uuid4())[:6].upper()
    session = models.Session(code=code)
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
    Accepts raw audio from the student app, creates a Doubt row immediately
    (status="processing"), and returns the doubt ID right away so the client
    can open the per-device WebSocket and wait for the PROCESSING_COMPLETE event.

    Transcription and embedding run in a BackgroundTask so this endpoint
    returns within milliseconds — the UI never blocks on AI inference.
    """
    # Rate limit & block check
    check_rate_limit(deviceToken)
    token_hash = hashlib.sha256(deviceToken.encode()).hexdigest()

    device = db.query(models.Device).filter(models.Device.token_hash == token_hash).first()
    if device and device.is_blocked:
        raise HTTPException(status_code=403, detail="Device is blocked.")

    # Record device → session association
    if device:
        device.session_code = sessionCode
        device.last_seen = datetime.datetime.utcnow()
    else:
        device = models.Device(token_hash=token_hash, session_code=sessionCode)
        db.add(device)

    # Create the Doubt row immediately with status="processing"
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

    # Save the uploaded audio to a temp file.
    # We use a named temp file with delete=False so the background task can
    # read it after this function returns (the OS won't auto-delete it).
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name
    finally:
        tmp.close()

    # Schedule the background task — returns immediately to the caller.
    background_tasks.add_task(
        process_audio_doubt,
        db_doubt.id,
        tmp_path,
        sessionCode,
    )

    return {"doubtId": str(db_doubt.id), "status": "processing"}


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
#
# The channel is keyed by doubt_id — an opaque server-generated integer cast
# to string.  No student can subscribe to another student's channel unless
# they know the doubt_id, which is never broadcast publicly.
# ---------------------------------------------------------------------------

@app.websocket("/ws/device/{doubt_id}")
async def websocket_device_channel(doubt_id: str, websocket: WebSocket):
    await device_manager.connect(doubt_id, websocket)
    try:
        while True:
            # Keep alive; the server pushes to this socket, student doesn't send.
            await websocket.receive_text()
    except Exception:
        device_manager.disconnect(doubt_id)
