# Whisper Slate — Project Specification

**Tagline:** Doubts don't need to be loud to be heard.

**Team:** Aarush Gupta · Adarsh Singh · Harshit Khattar

---

## 1. Elevator Pitch

Students whisper doubts into their own phone during a live lecture. Fully **on-device AI** transcribes and clusters those doubts silently — no cloud, no internet required, no hands raised. The teacher's laptop shows a live **"what to re-teach" dashboard**, ranking which doubts are shared by the most students, in real time.

---

## 2. Problem Statement

| Problem | Description |
|---|---|
| **Shy students stay silent** | Most students won't raise a hand in front of 60 classmates — the doubt just disappears. |
| **Feedback arrives too late** | Teachers learn what confused students only at test time, when re-teaching isn't an option. |
| **No signal, no pattern** | Even when students do ask, there's no way to see which doubts are shared by many. |

**Result:** the same syllabus is re-taught at the same pace — regardless of who actually understood it.

---

## 3. Solution Overview — Two Phases, One Continuous Flow

### 🔴 RED LIGHT — Pure Voice Capture (Student Side)
- Student whispers into their own phone — no laptop, no install (installable PWA, but no app store required).
- On-device AI transcribes it instantly, in-browser.
- Every doubt is timestamped and logged silently.
- Zero disruption to the ongoing lecture.

### 🟢 GREEN LIGHT — What-to-Re-Teach Dashboard (Teacher Side)
- Teacher's laptop receives doubts over the **local network only**.
- On-device embeddings cluster similar doubts together.
- Clusters ranked by frequency and by when they spiked.
- Teacher sees exactly what to re-teach, in real time.

---

## 4. End-to-End Data Flow (6 Steps)

1. **Whisper** — Push-to-talk capture on the student's own phone.
2. **Transcribe** — On-device Whisper model converts speech to text.
3. **Embed** — On-device MiniLM turns text into a meaning vector.
4. **Sync** — Sent over the local classroom network only.
5. **Cluster** — Similar doubts grouped automatically by meaning.
6. **Re-teach** — Dashboard ranks what the class needs revisited.

> **Critical constraint:** Steps 1–2–3 (whisper, transcribe, embed) run **entirely inside the student's browser** — no server, no cloud call, no internet. Only the resulting text + embedding vector is sent to the local sync server.

---

## 5. AI Models — 100% On-Device

Both models run inside the browser on the student's own phone, via `@huggingface/transformers` (WASM / WebGPU backend).

### Speech → Text: Whisper (tiny/base)
- Quantized Whisper model, runs client-side via **ONNX Runtime Web**.
- Transcribes the whispered doubt the instant recording stops — no audio ever leaves the phone.
- Footprint: ~75–145 MB · cached after first load · works with WiFi off (once cached).

### Text → Meaning: `Xenova/all-MiniLM-L6-v2`
- Lightweight on-device embedding model, turns each transcribed doubt into a **384-dim vector**.
- Ensures semantically similar doubts (e.g. "what's a stack overflow" and "why does recursion crash") cluster together by **meaning, not keywords**.
- Footprint: ~23 MB · runs via `@huggingface/transformers` · milliseconds per doubt.

---

## 6. Privacy & Infrastructure

| Guarantee | Detail |
|---|---|
| **Local network only** | Teacher's laptop + a small router (no WAN uplink) create a classroom-only network. Nobody outside the room can reach the server. |
| **Built for 60–80 devices** | A laptop's own hotspot caps at ~8–10 clients. A $20–40 travel router (OpenWrt-based) comfortably handles a full class. |
| **Teacher stays in control** | Live "connected devices" panel to kick/block any device, plus rate-limiting — the safety net if anyone still misbehaves. |

> **Hard guarantee:** No audio, no transcript, and no embedding ever leaves the classroom's own network.

---

## 7. Accountability & Moderation

| Mechanism | Detail |
|---|---|
| **College login required** | Every student signs in with their official college credentials before joining a session — no anonymous access to the app itself. |
| **Full traceability** | Every doubt is logged against the student's account, so any misuse can always be traced back to who sent it. |
| **Escalating bans** | Repeat misbehaviour escalates automatically: 1-day ban → 3-day ban → 7-day ban → full month ban for continued violations. |

> **Key nuance:** Inside a live class, doubts stay **anonymous to classmates and to the teacher as well** — only the moderation system (server-side, not shown in the UI) can trace a doubt back to a student. The teacher dashboard must never display student identity next to a doubt; identity resolution only happens through a separate, audited moderation/admin flow.

---

## 8. Tech Stack

| Component | Technology |
|---|---|
| Student capture | Push-to-talk web app (PWA), installable, no app-store friction |
| On-device STT | Whisper tiny/base via `@huggingface/transformers` (WASM/WebGPU) |
| On-device embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` |
| Local sync layer | FastAPI server bound to the classroom's local subnet only |
| Clustering | Agglomerative clustering over MiniLM vectors, tuned for small, noisy sets |
| Teacher dashboard | Live-ranked doubt clusters, spike timeline, device controls |

**Recommended concrete implementation choices:**
- Student PWA: React + Vite, `vite-plugin-pwa`, TypeScript, Tailwind CSS.
- On-device inference: `@huggingface/transformers` (formerly `transformers.js`) running Whisper (tiny/base, quantized) and `Xenova/all-MiniLM-L6-v2`, executed via ONNX Runtime Web (WASM, WebGPU if available).
- Local sync/backend: Python **FastAPI**, bound explicitly to the local subnet interface (e.g. `0.0.0.0` on the classroom LAN only, never exposed to WAN), WebSockets for live push to the teacher dashboard, SQLite (or in-memory + periodic snapshot) for session storage.
- Clustering: `scikit-learn` `AgglomerativeClustering` (cosine distance) over 384-dim MiniLM vectors, re-clustered incrementally as new doubts arrive; distance threshold tuned for small, noisy classroom-sized doubt sets (dozens, not thousands).
- Teacher dashboard: React + Vite, WebSocket client, charting for the spike timeline (e.g. `recharts`), device/session management panel.
- Auth: College SSO / institutional login (OAuth2 / SAML placeholder in MVP — mockable), JWT session tokens scoped to the local server only.

---

## 9. The Two Interfaces

### 9.1 Student Interface (Red Light — PWA on phone)
- **Login screen:** College credential sign-in (or class-code join in MVP), joins the classroom's local WiFi network.
- **Home / capture screen:** One large push-to-talk button. Press-and-hold or tap-to-record, tap-to-stop.
- **Processing state:** Local "transcribing…" indicator while Whisper runs in-browser (no network spinner — everything is local).
- **Confirmation state:** Brief, silent confirmation that the doubt was sent (e.g. a subtle checkmark) — no visible transcript review step needed to keep friction near-zero, but the student should be able to optionally view/edit before sending.
- **Zero classmate visibility:** Students never see other students' doubts, counts, or the dashboard.
- **Connection indicator:** Shows local network connectivity status (connected to classroom network / not connected).
- **No install friction:** Fully functional as an installable PWA; works after first load even with spotty/no internet (WiFi-off local mode once models are cached and connected to the classroom LAN).

### 9.2 Teacher Interface (Green Light — Dashboard on laptop)
- **Session screen:** Start/stop a live class session; QR code or class code for students to join the local network/app.
- **Live doubt-cluster dashboard:** Ranked list/cards of doubt clusters, each showing:
  - Representative phrase(s) for the cluster (paraphrased/aggregated, anonymous).
  - Count of doubts in the cluster.
  - A small spike/timeline sparkline showing when the cluster grew.
- **Spike timeline:** Overall timeline view showing when doubt volume spiked during the lecture.
- **Device control panel:** Live "connected devices" list with kick/block controls and rate-limit status.
- **No student identity ever shown:** The dashboard surfaces only aggregated, anonymous clusters — never a name, device ID, or individual transcript tied to a person.
- **End-of-session summary (roadmap item, see §11):** Not required for MVP but designed for later.

---

## 10. Non-Functional Requirements

- **On-device only for capture pipeline:** Whisper transcription and MiniLM embedding must never call an external/cloud API — this is a core product guarantee, not just a performance choice.
- **Low latency:** Transcription + embedding should complete in well under a few seconds on a mid-range phone for a short (5–15s) whispered doubt.
- **Scale:** Must comfortably support 60–80 simultaneous student devices on one local network/server.
- **Resilience:** No WAN/internet dependency during class once models are cached; app should clearly indicate offline/local-only status.
- **Anonymity by design:** No UI surface (student or teacher) ever displays a doubt-to-student mapping; that mapping exists only in a separate, access-controlled moderation store.
- **Zero cost to school:** Runs on phones students already carry and one classroom laptop + a cheap travel router — no additional hardware required.

---

## 11. Roadmap

| Stage | Scope |
|---|---|
| **Now** | On-device Whisper + MiniLM, local FastAPI sync, live-ranked dashboard |
| **Next** | Multilingual + code-switched doubt support (Hindi-English mixed speech) |
| **Later** | Urgency scoring, end-of-class auto-summary, LMS integration |

**The Ask:** A shot at classrooms actually using it.

---

## 12. Guiding Principle

> The goal isn't more data — it's turning silence into a signal teachers can act on, mid-lecture.