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
- **Session screen:** Start/stop a live class session; QR code or class code for students to join the local network/app. *(As of section 14, this screen also supports uploading the lecture's slides to seed topic-relevance context — see section 14.)*
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

---

## 13. Architecture Update — v2 (Server-Side AI, Moderation & Reply Loop)

**Status: current.** This section supersedes the on-device/client-side AI description in sections 4, 5, and 9.1 above. Sections 1–12 remain accurate for the product's *purpose and UX intent*; where they describe *where the AI runs*, this section is the source of truth. This update was introduced starting at Phase 6 of the implementation plan.

### 13.1 What changed and why

The original design ran Whisper and the MiniLM embedding model **inside the student's phone browser** via `@huggingface/transformers` / ONNX Runtime Web, so no audio or text ever had to leave the device to be processed. That was driven by a phone-first hackathon constraint that no longer applies to this project.

With that constraint gone, running two ML models (tens to hundreds of MB) inside every student's mobile browser is unnecessary complexity: it makes first load slow, adds browser-compatibility risk (WebGPU/WASM support varies), and is harder for a visitor to a GitHub repo to spin up and try. Since the project already runs a local FastAPI server that every device talks to anyway, **it makes more sense to run the AI once, server-side**, and keep the phone's job simple: record audio, upload it, show status.

### 13.2 Updated data flow

1. **Record** — student holds the push-to-talk button in `student-app`; audio is captured client-side (MediaRecorder), nothing else happens on-device.
2. **Upload** — the raw audio is POSTed to the local FastAPI server (`/doubts/audio`) along with the session code and an opaque device token. The server responds immediately with a doubt ID and a `processing` status — the upload does not block on transcription.
3. **Transcribe** — the server runs the audio through a local, open-source Whisper model (`faster-whisper`, tiny/base) to produce a transcript, then **discards the audio file** — raw audio is never stored at rest, preserving the product's original privacy commitment even though the processing step itself moved server-side.
4. **Embed** — the server embeds the transcript with `sentence-transformers` (`all-MiniLM-L6-v2`), the same model family as the original design, just running server-side instead of in-browser.
5. **Screen** — the server automatically checks the doubt for (a) an **appropriateness** signal (lightweight profanity/toxicity screening) and (b) a **topic-relevance** signal (cosine similarity against topic keywords the teacher entered when starting the session). Both are surfaced as flags/scores — neither auto-rejects anything.
6. **Review** — the doubt lands in the teacher's **moderation queue** with status `pending_review`, showing the transcript and both flags. The teacher **accepts** or **rejects** it, optionally attaching a reply message, and — for rejections — optionally attaching a **penalty duration**.
7. **Cluster** — only **accepted** doubts feed the ranked "what to re-teach" cluster view from section 9.2; pending doubts are tracked separately as a backlog counter so they don't pollute the ranking.
8. **Reply** — the review decision (accepted/rejected, reply text, penalty info) is pushed in real time to the *specific device* that submitted the doubt, over a per-device channel that is never exposed to any other student or broadcast on the anonymous dashboard channel.

### 13.3 Moderation model

- **Session topics:** when starting a session, the teacher can enter a short free-text list of lecture topics/keywords. These are embedded once and used as the topic-relevance reference for every doubt in that session.
- **Appropriateness screening:** automated, local, open-source (no cloud moderation API) — a fast first pass (profanity/keyword-based) is sufficient; a small local classifier can be layered in for better recall. This is always advisory — a human (the teacher) makes the final call.
- **Topic-relevance screening:** cosine similarity between a doubt's embedding and the session's topic embedding(s), against a documented, tunable threshold. Also advisory only.
- **Teacher decision, every time:** accept or reject, with an optional reply message either way, and — only on reject — an optional penalty duration chosen from a short preset list (e.g. none / 1 min / 5 min / 15 min / rest of session) or a custom value.
- **Penalty enforcement:** penalties are tracked server-side, keyed to the device's opaque token (never to a name or other identity), and enforced on that device's future doubt submissions and session rejoins — the client shows a countdown for UX, but the server is the source of truth.

### 13.4 What a student now sees

The state machine from section 9.1 gains two new terminal states after "Send":
- **Awaiting review** — the doubt has been uploaded and transcribed but not yet reviewed.
- **Accepted** — shown with any reply message the teacher attached, then the app returns to the capture screen.
- **Rejected** — shown with the reason, any reply message, and, if a penalty was applied, a live countdown during which the push-to-talk button is disabled.

This is a deliberate change from the original "send and forget" flow in section 9.1: students now get closed-loop feedback on every doubt they submit, which is part of what makes this a stronger, more complete product.

### 13.5 What stays the same

- The **anonymity model** from section 7 is unchanged in spirit: classmates and the teacher's normal dashboard view never see who submitted a doubt. The per-device reply channel routes by opaque device token, not identity, so it doesn't reintroduce identity into the anonymous surfaces.
- The **clustering approach** (agglomerative clustering, tuned for small noisy sets, ranked by count + recency) from sections 4 and 8 is unchanged — it now simply runs on server-computed embeddings instead of client-supplied ones, and filters to accepted doubts only.
- The **local-network-only** posture from section 6 is unchanged — the server still only needs to be reachable on the classroom's local network; moving AI server-side doesn't require any external/cloud connectivity, since `faster-whisper` and `sentence-transformers` both run fully locally on the server machine.

---

## 14. Feature Addition — Slide-Based Topic Context

**Status: current.** This section extends section 13.3's "session topics" mechanism. It does not replace typed topic keywords — it adds a richer, optional second source that can be used instead of or alongside them.

### 14.1 Motivation

Section 13.3 lets a teacher type a short list of topic keywords when starting a session, used as the reference point for topic-relevance scoring. That works but is a weak signal — a lecture actually covers far more nuance than 5-10 typed keywords capture, and typing them out is friction the teacher may skip under time pressure. Since the teacher already has lecture slides prepared, letting them **upload the slide deck directly** gives a much richer, more accurate, and lower-effort topic reference.

### 14.2 Extraction approach — local-first, with an optional pluggable enrichment hook

Consistent with the rest of this project's local-first posture (section 13.1's move to local, open-source AI), slide text extraction runs **entirely locally by default, with no external API required**:

| Slide format | Extraction method |
|---|---|
| PDF | `PyMuPDF` (`fitz`) — per-page text extraction |
| PPTX | `python-pptx` — text from shapes/text frames, plus speaker notes |
| Scanned/image-heavy pages (either format) | Optional local OCR via `pytesseract`, only if a page's directly-extracted text falls below a small character threshold; feature-flagged since it requires a system-level Tesseract install |

**Optional pluggable enrichment (off by default):** if the operator configures an external LLM provider (via an env var + API key), the raw extracted text can be passed through a summarization/keyword-extraction call to produce cleaner topic phrases, stored *alongside* (not replacing) the raw local extraction. If no provider is configured — the default — the app uses the raw local extraction only and is fully functional with **zero API keys**. This keeps the "clone and run" story intact for anyone trying the project from GitHub, while leaving a door open for teams that want a sharper enrichment step.

### 14.3 Updated data flow

1. **Upload** — from the session screen (section 9.2), the teacher uploads a PDF or PPTX of the lecture slides.
2. **Extract** — the server extracts one text chunk per slide/page (falling back to OCR per-page if configured and needed).
3. **Embed** — each non-empty chunk is embedded with the same `sentence-transformers` model already used elsewhere in the pipeline (section 13.2 step 4) — no new model is introduced.
4. **Review** — the teacher sees a quick list of the extracted chunks (short preview text per slide) and can exclude a few (e.g. a title slide, a "Thank You / Questions?" slide) that would otherwise dilute the relevance signal with noise. Typed topic keywords from section 13.3 remain available in the same review step and combine with the slide-derived chunks.
5. **Confirm** — once confirmed, all included chunks (slide-derived + typed) become the session's **topic reference set** — a *list* of reference embeddings, not a single blended vector.

### 14.4 Updated relevance scoring

Section 13.3's relevance score was originally a single cosine similarity against one topic embedding. With a reference *set* instead of a single vector, the relevance score for a doubt is computed as the **maximum similarity across the whole reference set** (or a top-k average, whichever proves more robust in testing) — not an average across all chunks, since averaging a 20-slide deck into one blurry vector would wash out genuinely on-topic doubts that only relate to one or two slides. This is documented as a tunable choice in the implementation, same as the original relevance threshold.

### 14.5 What stays the same

- Relevance and appropriateness flags remain **advisory only** — the teacher still makes every accept/reject decision (section 13.3).
- No slide content, extracted text, or embeddings ever leave the local server — same local-network-only posture as the rest of the system (section 6, section 13.5).
- Corrupt, password-protected, unsupported-format, or oversized uploads are rejected with a clear error rather than failing silently.