import json
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from database import Base

class Doubt(Base):
    __tablename__ = "doubts"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(String)
    embedding = Column(String) # JSON string of the vector
    session_code = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    device_token = Column(String, index=True, nullable=True) # Hashed token for rate limiting

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
