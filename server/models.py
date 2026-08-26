import json
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float
from datetime import datetime
from database import Base


class Doubt(Base):
    __tablename__ = "doubts"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, default="")
    embedding = Column(String, nullable=True)  # JSON string of the 384-dim vector; null until processing completes
    session_code = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Opaque SHA-256 hash of the device token — never the raw token.
    device_token_hash = Column(String, index=True, nullable=True)

    # Processing / moderation lifecycle:
    #   "processing"     — audio uploaded, transcription/embedding not yet complete
    #   "pending_review" — transcript + embedding ready, waiting for teacher decision
    #   "accepted"       — teacher accepted; doubt feeds the cluster dashboard
    #   "rejected"       — teacher rejected; doubt is excluded from clustering
    status = Column(String, default="processing", nullable=False)

    # Advisory flags set during server-side screening (neither auto-accepts nor auto-rejects).
    appropriateness_flag = Column(Boolean, nullable=True)   # True = possible issue flagged
    relevance_score = Column(Float, nullable=True)          # cosine similarity vs session topics

    def set_embedding(self, vector: list):
        self.embedding = json.dumps(vector)

    def get_embedding(self) -> list:
        return json.loads(self.embedding) if self.embedding else []


class Session(Base):
    __tablename__ = "sessions"

    code = Column(String, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class Device(Base):
    __tablename__ = "devices"

    token_hash = Column(String, primary_key=True, index=True)
    is_blocked = Column(Boolean, default=False)
    session_code = Column(String, index=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
