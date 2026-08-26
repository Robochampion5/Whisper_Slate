import json
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
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
    appropriateness_score = Column(Float, nullable=True)    # 0.0 (clean) – 1.0 (flagged)
    relevance_score = Column(Float, nullable=True)          # cosine similarity vs session topics (0–1)
    relevance_flag = Column(Boolean, nullable=True)         # True = below RELEVANCE_FLAG_THRESHOLD

    # Set on rejection: one of "Inappropriate", "Off-topic", "Spam", "Other"
    review_reason = Column(String, nullable=True)

    def set_embedding(self, vector: list):
        self.embedding = json.dumps(vector)

    def get_embedding(self) -> list:
        return json.loads(self.embedding) if self.embedding else []


class Session(Base):
    __tablename__ = "sessions"

    code = Column(String, primary_key=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    # JSON list of 384-dim embedding vectors, one per topic phrase entered at session start.
    # Null when no topics were provided.  Used for relevance scoring of incoming doubts.
    topic_embedding = Column(String, nullable=True)

    def set_topic_embeddings(self, vectors: list[list[float]]):
        self.topic_embedding = json.dumps(vectors)

    def get_topic_embeddings(self) -> list[list[float]]:
        return json.loads(self.topic_embedding) if self.topic_embedding else []


class Device(Base):
    __tablename__ = "devices"

    token_hash = Column(String, primary_key=True, index=True)
    is_blocked = Column(Boolean, default=False)
    session_code = Column(String, index=True)
    last_seen = Column(DateTime, default=datetime.utcnow)


class Penalty(Base):
    """
    Records a moderation penalty applied to a device token hash.
    Keyed by device_token_hash (opaque, never real identity) per §13.3.
    The client shows a UX countdown; the server is the source of truth for enforcement.
    """
    __tablename__ = "penalties"

    id = Column(Integer, primary_key=True, index=True)
    device_token_hash = Column(String, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    reason = Column(String, nullable=True)   # mirrors Doubt.review_reason
    doubt_id = Column(Integer, ForeignKey("doubts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
