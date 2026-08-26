# Whisper Slate — Local Sync Server

Python + FastAPI. Runs on the teacher's laptop during a live session.

## What it does

- Receives raw audio uploads from students (`POST /doubts/audio`).
- Runs **server-side AI** locally — no cloud API calls, no external keys needed:
  - **Speech-to-text:** `faster-whisper` (`base`, CPU, int8 quantised) — fast and accurate for short classroom whispers.
  - **Semantic embedding:** `sentence-transformers` `all-MiniLM-L6-v2` (384-dim) — same model family as the original design, now running server-side.
- Both models are loaded **once at startup**, not per-request.
- **Temp audio is deleted immediately** after transcription — raw audio is never stored at rest.
- Clusters accepted doubts with `scikit-learn` `AgglomerativeClustering` (cosine distance).
- Pushes live updates over WebSockets:
  - `/ws/dashboard` — cluster state to the teacher dashboard.
  - `/ws/device/{doubtId}` — review decision to the specific student device.

## Security guarantee

Raw audio is written to a named temp file, passed to `faster-whisper`, then `os.remove()`'d **immediately after transcription completes** (inside the `process_audio_doubt` background task) — even on failure. Audio never persists on disk.

Doubts are stored against a SHA-256 hash of the device token, never a real identity.

## Running

```bash
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

> **First startup** will download model weights:
> - `faster-whisper` base: ~145 MB (cached in `~/.cache/huggingface`)
> - `sentence-transformers` all-MiniLM-L6-v2: ~23 MB (same cache)
>
> Subsequent starts use the local cache — no internet required.

⚠️ **Network binding:** on a real classroom deployment, bind to your LAN IP only — not `0.0.0.0` if the machine is on a public/campus network.

```bash
uvicorn main:app --host 192.168.1.5 --port 8000
```

## Key endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/ping` | Health check |
| `POST` | `/session/start` | Create a new session → `{ sessionCode }` |
| `POST` | `/session/join` | Student joins → `{ device_token }` |
| `POST` | `/doubts/audio` | Upload raw audio; returns `{ doubtId, status: "processing" }` immediately |
| `GET` | `/clusters` | Current cluster state for a session |
| `WS` | `/ws/dashboard` | Live cluster broadcasts to teacher |
| `WS` | `/ws/device/{doubtId}` | Per-device review decision push |

## Key files

| File | Purpose |
|---|---|
| `ai_pipeline.py` | Loads faster-whisper + sentence-transformers; `transcribe()` + `embed()` |
| `main.py` | FastAPI app, all endpoints, background task, WS managers |
| `models.py` | SQLAlchemy models: `Doubt`, `Session`, `Device` |
| `clustering.py` | Agglomerative clustering over 384-dim embeddings |
| `requirements.txt` | Python dependencies with rationale comments |
