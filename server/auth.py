"""
auth.py — JWT utilities and ban escalation logic for Whisper Slate (§7, §8).

MVP implementation uses mock college IDs from environment variable.
Production would integrate with institutional SSO (OAuth2/SAML).
"""

import os
import jwt
import datetime
import uuid
from typing import Optional

# JWT secret — in production this MUST be a strong random secret
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24 * 7  # 7 days

# Mock college IDs for MVP — production would use real SSO
# Format: COLLEGE_ID:PASSWORD (comma-separated)
# Example: AUTH_COLLEGE_IDS="student1:pass123,student2:pass456"
MOCK_COLLEGE_IDS = {}
auth_ids_str = os.environ.get("AUTH_COLLEGE_IDS", "")
if auth_ids_str:
    for pair in auth_ids_str.split(","):
        if ":" in pair:
            cid, pwd = pair.strip().split(":", 1)
            MOCK_COLLEGE_IDS[cid] = pwd


def validate_college_login(college_id: str, password: str) -> bool:
    """
    MVP: Validate against mock credentials from environment.
    Production: Replace with OAuth2/SAML flow.
    """
    return MOCK_COLLEGE_IDS.get(college_id) == password


def create_jwt(user_id: int, college_id: str) -> str:
    """
    Create a JWT token containing user_id, college_id, and a unique JTI (JWT ID).
    The JTI is used for server-side revocation via logout.
    """
    jti = str(uuid.uuid4())  # Unique token identifier for blacklist
    payload = {
        "user_id": user_id,
        "college_id": college_id,
        "jti": jti,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    """
    Decode and verify a JWT token.
    Returns the payload dict on success, None on any failure.
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def calculate_penalty_duration(user_id: int, db_session) -> tuple[int, int]:
    """
    Calculate penalty duration based on user's ban history (§7 escalation).

    Returns: (penalty_seconds, ban_level)
    - ban_level 0: timeout (5 minutes, not a ban)
    - ban_level 1: 1 day
    - ban_level 2: 3 days
    - ban_level 3: 7 days
    - ban_level 4+: 30 days

    Escalation is based on the count of previous bans (is_ban=True).
    """
    from models import Penalty  # Import here to avoid circular dependency

    # Count previous bans for this user
    previous_bans = (
        db_session.query(Penalty)
        .filter(Penalty.user_id == user_id, Penalty.is_ban == True)
        .count()
    )

    # First offense: 5-minute timeout (not counted as a ban)
    if previous_bans == 0:
        return 5 * 60, 0

    # Escalating bans
    if previous_bans == 1:
        return 24 * 3600, 1  # 1 day
    elif previous_bans == 2:
        return 3 * 24 * 3600, 2  # 3 days
    elif previous_bans == 3:
        return 7 * 24 * 3600, 3  # 7 days
    else:
        return 30 * 24 * 3600, 4  # 30 days
