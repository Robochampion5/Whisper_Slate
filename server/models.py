import json
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from datetime import datetime
from database import Base


class User(Base):
    """
    User account — linked to college credentials (§7, §8).
    MVP uses mock college IDs; production integrates institutional SSO.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    college_id = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    is_banned = Column(Boolean, default=False)
    ban_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Doubt(Base):
    __tablename__ = "doubts"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, default="")
    embedding = Column(String, nullable=True)  # JSON string of the 384-dim vector; null until processing completes
    session_code = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Opaque SHA-256 hash of the device token — never the raw token.
    device_token_hash = Column(String, index=True, nullable=True)

    # User FK for traceability (§7) — dashboard never shows this
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

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

    # Finalised topic reference set: JSON list of 384-dim embedding vectors,
    # one per included slide chunk AND one per typed keyword phrase.
    # Set by POST /session/{code}/confirm-topics; null until confirmed.
    # score_relevance() handles null gracefully (returns 0.0, not flagged).
    topic_embedding = Column(String, nullable=True)

    # Raw keyword phrases typed by the teacher at session start (Phase 7).
    # Stored as a JSON list of strings; embedded into topic_embedding at confirm-topics.
    # Null when no keywords were typed.
    pending_topic_phrases = Column(String, nullable=True)

    def set_topic_embeddings(self, vectors: list[list[float]]):
        self.topic_embedding = json.dumps(vectors)

    def get_topic_embeddings(self) -> list[list[float]]:
        return json.loads(self.topic_embedding) if self.topic_embedding else []

    def set_pending_phrases(self, phrases: list[str]):
        self.pending_topic_phrases = json.dumps(phrases)

    def get_pending_phrases(self) -> list[str]:
        return json.loads(self.pending_topic_phrases) if self.pending_topic_phrases else []


class Device(Base):
    __tablename__ = "devices"

    token_hash = Column(String, primary_key=True, index=True)
    is_blocked = Column(Boolean, default=False)
    session_code = Column(String, index=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    # User FK for traceability
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)


class Penalty(Base):
    """
    Records a moderation penalty applied to a device token hash.
    Keyed by device_token_hash (opaque, never real identity) per §13.3.
    The client shows a UX countdown; the server is the source of truth for enforcement.

    Escalating bans (§7): ban_level tracks progression (0=timeout, 1-4=bans).
    """
    __tablename__ = "penalties"

    id = Column(Integer, primary_key=True, index=True)
    device_token_hash = Column(String, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    reason = Column(String, nullable=True)   # mirrors Doubt.review_reason
    doubt_id = Column(Integer, ForeignKey("doubts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Escalation fields
    is_ban = Column(Boolean, default=False, nullable=False)  # False = timeout, True = escalating ban
    ban_level = Column(Integer, default=0, nullable=False)  # 0=timeout, 1=1d, 2=3d, 3=7d, 4=30d


class SlideChunk(Base):
    """
    One extracted text chunk per slide/page from an uploaded slide deck (§14.2–14.3).

    Persisted per-session during the teacher's review step so the UI can render
    the checklist without re-extracting.  Rows are replaced on each new upload for
    a session (previous chunks for the same session_code are deleted first).

    After POST /session/{code}/confirm-topics, these rows are no longer needed but
    are kept for audit — they are NOT deleted, so the teacher can always see what
    was in the reference set.
    """
    __tablename__ = "slide_chunks"

    id = Column(Integer, primary_key=True, index=True)
    session_code = Column(String, index=True, nullable=False)
    slide_index = Column(Integer, nullable=False)          # 0-based slide/page number
    raw_text = Column(String, nullable=False)              # locally-extracted text
    enriched_text = Column(String, nullable=True)          # optional LLM-summarised keywords
    source_filename = Column(String, nullable=False)
    included = Column(Boolean, default=True, nullable=False)  # teacher's checkbox state
    char_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
