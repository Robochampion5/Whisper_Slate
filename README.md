# Whisper Slate 🎤🏫

> *Doubts don't need to be loud to be heard.*

Students whisper a doubt into their phone during a live lecture — a push-to-talk button, no typing. The audio is uploaded to a local classroom server, transcribed and embedded server-side, then routed into the teacher's live **"what to re-teach" dashboard**, ranked by how many students share the same confusion, in real time.

**Team:** Aarush Gupta · Adarsh Singh · Harshit Khattar

---

## Architecture (v2)

This is a monorepo with three parts:

### `/student-app` — React + Vite + TypeScript PWA

- Push-to-talk audio capture via the browser's `MediaRecorder` API.
- On recording stop, the raw audio `Blob` (webm/opus) is POSTed as `multipart/form-data` to `POST /doubts/audio` on the server.
- The server responds immediately with `{ doubtId, status: "processing" }` — the UI never blocks on AI inference.
- A per-device WebSocket (`/ws/device/{doubtId}`) delivers the teacher's decision live:
  - **Awaiting review** — doubt is in the teacher's moderation queue.
  - **Accepted** — shown with any teacher reply; app returns to capture.
  - **Rejected** — shown with reason and, if a penalty was applied, a live countdown during which recording is disabled.
- No AI model runs in the browser. No model download on first load.

### `/server` — Python + FastAPI

- `POST /doubts/audio` — accepts raw audio upload; returns `doubtId` immediately; schedules a `BackgroundTask` for AI processing.
- **AI pipeline** (loaded once at server startup, runs fully locally):
  - [`faster-whisper`](https://github.com/SYSTRAN/faster-whisper) (`base`, CPU, int8) — speech-to-text.
  - [`sentence-transformers`](https://www.sbert.net/) (`all-MiniLM-L6-v2`) — 384-dim semantic embedding.
- After transcription, the **temp audio file is deleted immediately** — raw audio is never stored at rest.
- Transcript + embedding feed into `AgglomerativeClustering` (scikit-learn) for the teacher dashboard.
- Teacher moderation: doubts land in a `pending_review` queue; teacher accepts or rejects (with optional reply + penalty). Only **accepted** doubts appear in the cluster ranking.
- WebSockets: `/ws/dashboard` broadcasts cluster updates to the teacher app; `/ws/device/{doubtId}` pushes the review decision to the specific student.

### `/teacher-app` — React + Vite + TypeScript

- Live ranked doubt clusters grouped by semantic meaning, not keywords.
- Spike timeline showing when confusion peaked during the lecture.
- Moderation queue: accept / reject each doubt with optional reply and penalty.
- Connected-devices panel with kick/block controls.

---

## Privacy & Security

| Guarantee | How it's enforced |
|---|---|
| **Audio never stored** | Temp file deleted immediately after `faster-whisper.transcribe()` returns — even on failure. |
| **No cloud calls** | `faster-whisper` and `sentence-transformers` run locally on the server machine. Zero external API keys needed. |
| **Anonymous to classmates** | Teacher dashboard shows only aggregated, anonymous clusters — never a name or individual transcript tied to a person. |
| **Local network only** | FastAPI server binds to the classroom LAN; no WAN exposure required. |
| **Traceable to moderators only** | Doubts are stored against a hashed device token for moderation, never a real identity visible in any UI. |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10

### 1. Start the server

```bash
cd server
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

> **First run:** `faster-whisper` and `sentence-transformers` will download their model weights (~145 MB and ~23 MB respectively) to a local cache on the first startup. Subsequent starts are instant.

*Server runs at http://localhost:8000*

### 2. Start the teacher dashboard

```bash
cd teacher-app
npm install
npm run dev -- --port 5174
```

*Open http://localhost:5174*

### 3. Start the student app

```bash
cd student-app
npm install
npm run dev -- --port 5173
```

*Open http://localhost:5173 on a phone on the same Wi-Fi, or use the QR code from the teacher dashboard.*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Student capture | React 19, Vite, TypeScript, Tailwind CSS, PWA (`vite-plugin-pwa`) |
| Audio capture | Browser `MediaRecorder` API (webm/opus) |
| Speech-to-text | `faster-whisper` base — CTranslate2, int8, CPU |
| Semantic embedding | `sentence-transformers` `all-MiniLM-L6-v2`, 384 dims |
| Local sync server | Python FastAPI, SQLite, WebSockets |
| Clustering | `scikit-learn` `AgglomerativeClustering` (cosine distance) |
| Teacher dashboard | React 19, Vite, TypeScript, Tailwind CSS, `recharts` |
