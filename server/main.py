from fastapi import FastAPI, Depends, HTTPException, Header, WebSocket, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict
import hashlib
import uuid
import datetime
import asyncio

import models
from database import SessionLocal, engine
import clustering

# Create tables
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

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Rate limiting (in-memory token bucket/counter for MVP)
# Maps device_token -> { 'count': int, 'reset_time': datetime }
RATE_LIMIT_STORE: Dict[str, dict] = {}
RATE_LIMIT_MAX = 5 # 5 doubts per minute

def check_rate_limit(device_token: str):
    now = datetime.datetime.utcnow()
    record = RATE_LIMIT_STORE.get(device_token)
    
    if not record or now > record['reset_time']:
        # Reset or initialize
        RATE_LIMIT_STORE[device_token] = {
            'count': 1,
            'reset_time': now + datetime.timedelta(minutes=1)
        }
        return
    
    if record['count'] >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute.")
    
    record['count'] += 1

# WebSocket manager for Teacher Dashboard
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_json(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except:
                pass

manager = ConnectionManager()

# --- Pydantic Schemas ---
class JoinRequest(BaseModel):
    classCode: str

class JoinResponse(BaseModel):
    device_token: str

class DoubtCreate(BaseModel):
    text: str
    embedding: List[float]
    sessionCode: str
    timestamp: datetime.datetime

class SessionStartResponse(BaseModel):
    sessionCode: str

# --- Endpoints ---

@app.get("/ping")
def ping():
    return {"status": "ok"}

@app.post("/session/join", response_model=JoinResponse)
def join_session(req: JoinRequest, db: Session = Depends(get_db)):
    # In a real app, validate classCode. For MVP, just accept it and generate an opaque token.
    device_token = str(uuid.uuid4())
    token_hash = hashlib.sha256(device_token.encode()).hexdigest()
    
    # Save to db
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

def generate_dashboard_payload(session_code: str, db: Session):
    # Fetch all doubts for session
    doubts_orm = db.query(models.Doubt).filter(models.Doubt.session_code == session_code).all()
    doubts = [
        {
            'id': d.id,
            'text': d.text,
            'embedding': d.get_embedding(),
            'timestamp': d.timestamp
        } for d in doubts_orm
    ]
    
    clusters = clustering.compute_clusters(doubts)
    
    # Global timeline
    global_timeline = []
    # Simplified: count doubts per minute
    time_counts = {}
    for d in doubts_orm:
        minute = d.timestamp.replace(second=0, microsecond=0).isoformat()
        time_counts[minute] = time_counts.get(minute, 0) + 1
        
    for k, v in sorted(time_counts.items()):
        global_timeline.append({"time": k, "count": v})
        
    # Devices list (we only return partial hashes to the UI for anon identification)
    devices_orm = db.query(models.Device).filter(models.Device.session_code == session_code).all()
    devices = [{"id": d.token_hash[:8], "full_token": "hidden", "is_blocked": d.is_blocked} for d in devices_orm]
    
    return {
        "type": "CLUSTER_UPDATE",
        "sessionCode": session_code,
        "clusters": clusters,
        "global_timeline": global_timeline,
        "devices": devices
    }

async def recluster_and_broadcast(session_code: str):
    db = SessionLocal()
    try:
        payload = generate_dashboard_payload(session_code, db)
        await manager.broadcast_json(payload)
    finally:
        db.close()

@app.post("/doubts")
async def create_doubt(doubt: DoubtCreate, background_tasks: BackgroundTasks, x_device_token: str = Header(...), db: Session = Depends(get_db)):
    # 1. Rate Limit & Block Check
    check_rate_limit(x_device_token, db)
    
    # 2. Record device for this session if not yet recorded
    token_hash = hashlib.sha256(x_device_token.encode()).hexdigest()
    device = db.query(models.Device).filter(models.Device.token_hash == token_hash).first()
    if device:
        device.session_code = doubt.sessionCode
        device.last_seen = datetime.datetime.utcnow()
    else:
        new_device = models.Device(token_hash=token_hash, session_code=doubt.sessionCode)
        db.add(new_device)
        
    # 3. Create DB Record (NO AUDIO, NO REAL IDENTITY)
    db_doubt = models.Doubt(
        text=doubt.text,
        session_code=doubt.sessionCode,
        device_token_hash=token_hash,
        timestamp=doubt.timestamp
    )
    db_doubt.set_embedding(doubt.embedding)
    
    db.add(db_doubt)
    db.commit()
    db.refresh(db_doubt)
    
    # 4. Schedule background task to recluster and broadcast to Teacher Dashboards
    background_tasks.add_task(recluster_and_broadcast, doubt.sessionCode)
    
    return {"status": "received", "id": db_doubt.id}

@app.get("/clusters")
def get_clusters(sessionCode: str, db: Session = Depends(get_db)):
    payload = generate_dashboard_payload(sessionCode, db)
    return payload

@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Just keep connection alive
            await websocket.receive_text()
    except:
        manager.disconnect(websocket)
