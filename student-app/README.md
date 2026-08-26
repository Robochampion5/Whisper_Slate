# Whisper Slate — Student App

React + Vite + TypeScript PWA. Runs on students' phones during a live lecture.

## What it does

1. **Login** — student enters the class code to join the session.
2. **Capture** — push-to-hold mic button; audio is recorded via `MediaRecorder` (webm/opus).
3. **Upload** — on release, the raw audio `Blob` is POSTed to `POST /doubts/audio` on the local server.
4. **Awaiting review** — a per-device WebSocket (`/ws/device/{doubtId}`) keeps the student updated while the teacher reviews the doubt.
5. **Outcome** — shows the teacher's decision:
   - ✅ **Accepted** — green checkmark + optional teacher reply, then back to capture.
   - ❌ **Rejected** — reason + optional reply + live penalty countdown (recording disabled during penalty).

No AI model runs in the browser. No model download on first load.

## State machine

```
LOGIN → CAPTURE → UPLOADING → AWAITING_REVIEW → OUTCOME
                                                    ↓
                                              (back to CAPTURE)
```

## Dev

```bash
npm install
npm run dev        # http://localhost:5173
```

Set `VITE_API_URL` to point at the server if it's not on `localhost:8000`:

```bash
VITE_API_URL=http://192.168.1.5:8000 npm run dev
```

## Key files

| File | Purpose |
|---|---|
| `src/services/audio.ts` | `MediaRecorder` capture → raw `Blob` |
| `src/services/api.ts` | `uploadAudio()` multipart POST, `deviceChannelUrl()` |
| `src/components/UploadingScreen.tsx` | Network upload indicator |
| `src/components/AwaitingReviewScreen.tsx` | Per-device WS, "with your teacher" state |
| `src/components/ConfirmationScreen.tsx` | Accepted / Rejected outcome + penalty countdown |
| `src/App.tsx` | State machine |
