"""
ai_pipeline.py — Server-side AI models for Whisper Slate (v2 architecture, §13.1).

Both models are loaded ONCE at module-import time (i.e. at server startup), not per-request.
This keeps per-request latency low and avoids redundant GPU/CPU memory allocation.

Model choices (see Project_spec.md §13.2):
  • faster-whisper "base" — CTranslate2-backed Whisper, int8 quantised, CPU-friendly.
    Produces a transcript from short (5–15 s) classroom whispers in a few seconds on a laptop CPU.
    No cloud API; runs entirely on the local server machine.

  • sentence-transformers "all-MiniLM-L6-v2" — same model family as the original client-side
    Xenova/all-MiniLM-L6-v2 used in Phase 2/3; identical 384-dim embedding space so the
    agglomerative clustering logic in clustering.py requires zero changes.
    No cloud API; runs locally.
"""

import logging
from faster_whisper import WhisperModel
from sentence_transformers import SentenceTransformer

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
