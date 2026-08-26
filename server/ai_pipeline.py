"""
ai_pipeline.py — Server-side AI models for Whisper Slate (v2 architecture, §13.1).

Both ML models are loaded ONCE at module-import time (i.e. at server startup), not per-request.
This keeps per-request latency low and avoids redundant GPU/CPU memory allocation.

Model choices (see Project_spec.md §13.2):
  • faster-whisper "base" — CTranslate2-backed Whisper, int8 quantised, CPU-friendly.
    Produces a transcript from short (5–15 s) classroom whispers in a few seconds on a laptop CPU.
    No cloud API; runs entirely on the local server machine.

  • sentence-transformers "all-MiniLM-L6-v2" — same model family as the original client-side
    Xenova/all-MiniLM-L6-v2 used in Phase 2/3; identical 384-dim embedding space so the
    agglomerative clustering logic in clustering.py requires zero changes.
    No cloud API; runs locally.

Pre-screening helpers (§13.3):
  • check_appropriateness() — uses better-profanity (keyword/pattern list, no model, no download).
    Fast, local, advisory only — never auto-rejects.

  • score_relevance() — cosine similarity between a doubt's embedding and the session's topic
    reference embeddings, following the max-similarity approach from §14.4.
    Returns 0.0 when no topics have been set for the session.
"""

import logging
import numpy as np
from faster_whisper import WhisperModel
from sentence_transformers import SentenceTransformer
from better_profanity import profanity

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Speech-to-text: faster-whisper "base", CPU, int8
# "base" balances accuracy vs. speed for short classroom doubts.
# Switch to "tiny" if startup time on weak hardware is a concern.
# ---------------------------------------------------------------------------
logger.info("Loading faster-whisper 'base' model (CPU, int8) …")
_whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
logger.info("faster-whisper model ready.")

# ---------------------------------------------------------------------------
# Text embedding: all-MiniLM-L6-v2, 384 dimensions
# ---------------------------------------------------------------------------
logger.info("Loading sentence-transformers 'all-MiniLM-L6-v2' model …")
_embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
logger.info("sentence-transformers model ready.")

# ---------------------------------------------------------------------------
# Appropriateness screening: better-profanity initialised with the default
# word list.  Load once; the censor list is an in-memory set — no I/O per call.
# ---------------------------------------------------------------------------
profanity.load_censor_words()

# ---------------------------------------------------------------------------
# Relevance scoring threshold (§13.3, §14.4).
# Doubts whose max cosine similarity to any topic embedding falls below this
# value are flagged as possibly off-topic — advisory only, never auto-rejected.
# Documented here as a tunable constant; adjust after empirical classroom testing.
# ---------------------------------------------------------------------------
RELEVANCE_FLAG_THRESHOLD = 0.25


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def transcribe(audio_path: str) -> str:
    """
    Run faster-whisper on the audio file at *audio_path* and return the
    plain-text transcript.  The file is NOT deleted here — the caller is
    responsible for deleting it immediately after this function returns
    (see process_audio_doubt in main.py).
    """
    segments, _info = _whisper_model.transcribe(audio_path, beam_size=5)
    text = " ".join(seg.text.strip() for seg in segments).strip()
    return text


def embed(text: str) -> list[float]:
    """
    Embed *text* with all-MiniLM-L6-v2 (mean pooling, L2-normalised),
    returning a plain Python list of 384 floats suitable for JSON serialisation.
    """
    vector = _embedding_model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def check_appropriateness(text: str) -> tuple[bool, float]:
    """
    Run a lightweight, local appropriateness check using better-profanity.

    Returns:
        (flagged: bool, score: float)
        • flagged — True if the text contains profane/inappropriate content.
        • score   — 1.0 if flagged, 0.0 if clean.  A future classifier could
                    return a continuous value here; keeping the return type
                    consistent now makes that upgrade non-breaking.

    This is always advisory — it never auto-rejects a doubt (§13.3).
    """
    flagged = profanity.contains_profanity(text)
    score = 1.0 if flagged else 0.0
    return flagged, score


def score_relevance(
    doubt_embedding: list[float],
    topic_embeddings: list[list[float]],
) -> tuple[float, bool]:
    """
    Compute topic-relevance of a doubt against the session's topic reference set.

    Follows the max-similarity approach from §14.4: take the highest cosine
    similarity across all reference embeddings rather than averaging them,
    so a doubt that relates to *any one* topic in the session is not washed out
    by unrelated slides/topics in the average.

    Args:
        doubt_embedding:  384-dim embedding of the doubt transcript.
        topic_embeddings: list of 384-dim embeddings, one per topic phrase/slide.
                          If empty, relevance is undefined — returns (0.0, False).

    Returns:
        (relevance_score: float, relevance_flag: bool)
        • relevance_score — max cosine similarity in [0, 1].
        • relevance_flag  — True if score < RELEVANCE_FLAG_THRESHOLD (possibly off-topic).

    All embeddings are L2-normalised by the embedding model, so cosine similarity
    is just the dot product.
    """
    if not topic_embeddings:
        return 0.0, False

    doubt_vec = np.array(doubt_embedding, dtype=np.float32)
    topic_matrix = np.array(topic_embeddings, dtype=np.float32)

    # Since all vectors are already L2-normalised, dot product == cosine similarity.
    similarities = topic_matrix @ doubt_vec
    max_sim = float(np.max(similarities))

    # Clamp to [0, 1] — cosine similarity of normalised vectors is in [-1, 1],
    # but negative values (completely orthogonal meaning) are practically 0 relevance.
    max_sim = max(0.0, min(1.0, max_sim))
    flagged = max_sim < RELEVANCE_FLAG_THRESHOLD

    return max_sim, flagged
