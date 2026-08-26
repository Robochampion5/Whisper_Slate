# Whisper Slate — iQOO Hackathon 2026 Compliance Addendum

This addendum captures the event rules, format, and scoring for the **iQOO Hackathon 2026** (organized by iQOO and Reskilll — `iqoo.reskilll.com`) that Whisper Slate is being built for. It does **not** replace `Project_spec.md`; it sits alongside it as the ruleset the build (from Phase 6 onward) must conform to. Phases 0–5 are unchanged and already implemented.

---

## 1. Event Format

- **India's biggest phone-first hackathon series.** 30-hour city battles across Bengaluru, Pune, Chennai, and Hyderabad (29 Aug – 27 Sep 2026), feeding into a 48-hour Grand Finale in Bengaluru (9–11 Oct 2026). Prize pool: ₹40,00,000.
- **Each City Battle:** ~30 hours all-inclusive, Saturday ~08:00 check-in through Sunday ~17:00 awards.
- **Pure hacking window:** Saturday 11:00 → Sunday 12:00 (25 hours), split into:
  - **🔴 Red Light (~55%, ~10.5h):** iQOO phone only. Every route between phone and laptop goes through **Office Kit**. Laptop is closed as a build machine — mirrored, driven from the keyboard, files moved without a cable, but no independent laptop use.
  - **🟢 Green Light (~45%, ~8.5h):** Both devices usable directly — the opening sprint, mentor rounds, the overnight window, and demo polish.
  - Two short green "breather" windows ease the longer red stretches.
  - Two scored **evaluation rounds** (Saturday evening, Sunday morning) sit **outside** this Red/Green split and feed the Top 10 pitch.

---

## 2. Devices

- **One flagship iQOO loaner phone per person**, handed over at Saturday check-in, running **OriginOS 6**, with **HackTracker pre-installed** and **Office Kit already paired** to your laptop.
- Devices remain iQOO property — stay in the venue/designated hacking zone, returned before exit.
- **HackTracker** captures **counts and durations only** (no keystrokes, screenshots, or browsing) — used purely for the "creative phone use" and "Office Kit usage" scoring dimensions.

---

## 3. Office Kit — The Phone↔Laptop Bridge

Office Kit links the iQOO phone to the laptop across one connection:

| Feature | What it does |
|---|---|
| **Screen mirror** | The phone UI on the laptop display, live — demo, debug, drive the build without picking the phone up. |
| **Shared clipboard** | Copy on one device, paste on the other — tokens, snippets, prompts, logs, no chat app needed. |
| **File transfer** | Drag-and-drop files/folders between phone and laptop, no size/format limit, no cable. |
| **Remote control** | Laptop keyboard + trackpad drives the phone — type into the device at full speed, especially useful during Red Light. |

- During **Red Light**, Office Kit is the *only* route between the two devices.
- During **Green Light**, it's how the phone stays in the loop while the laptop does heavy compute.
- **Office Kit usage is 10% of the total score**, read off HackTracker device data (counts/durations only, not self-reported).

---

## 4. Phone-First Build Requirements

- **The iQOO phone is both the build surface and the demo surface: every entry must run and pitch on the phone.**
- A **local or open-source model at the core** earns brownie points, with the phone kept in the loop via Office Kit.
- **On-device inference targets the Snapdragon NPU.** Free AI credits are available for the weekend (for anything that isn't fully local).
- **Stacks welcome:** native Android, Flutter, React Native, or **PWA** — any of these qualifies *if it runs on the phone with a local or open-source model at the core*.

**How Whisper Slate already satisfies this:** the student capture app is a PWA (React + Vite + `vite-plugin-pwa`) that runs directly in the phone's browser, and it runs Whisper (tiny/base) + `Xenova/all-MiniLM-L6-v2` **fully on-device** via `@huggingface/transformers` / ONNX Runtime Web — no cloud inference. That is exactly the "local/open-source model at the core, phone as build+demo surface" pattern the rules reward.

**What needs adjusting from Phase 6 onward:** the teacher dashboard (`teacher-app`) was designed as a laptop-only React app. Under Green Light rules that's allowed (both devices), but for a phone-first demo and for the Top 10 pitch, the safest and highest-scoring approach is to make `teacher-app` **fully usable in a phone browser too** (responsive layout, no desktop-only interactions), so the *entire* product — capture and dashboard — can be shown running on iQOO phones, with Office Kit's screen mirror used to project one of those phones onto a laptop/big screen for judges to see clearly. This turns Office Kit from a checkbox into a genuinely used part of the product's own demo, which is exactly what the "Office Kit usage" score rewards.

---

## 5. Tracks

- Seven tracks in city battles; the Grand Finale runs six (drops FinTech & Commerce, Smart Education & HealthTech; adds Mobility & Community App).
- Tracks are open to students and working professionals, but teams cannot mix buckets.
- Tracks are **broad domains, not fixed briefs** — anything that fits is fair game. **Open Innovation is a wildcard everywhere.**
- Whisper Slate fits **Smart Education** at the city-battle level. Since Smart Education is dropped at the Grand Finale, a team advancing that far should plan to re-position/submit under **Open Innovation** for the Finale round — this is a submission-metadata decision, not a product change.

---

## 6. Build Rules

- **Original work only:** code written during the event window. No shipping a pre-built product.
- Open-source libraries/frameworks are fine **with attribution**; carrying in a completed app is not.
- Submit repo + demo assets on the **Reskilll platform** (`iqoo.reskilll.com`) before the hard cutoff — **repos lock before the Top 10 pitches.** Late submissions may incur scoring penalties or disqualification.
- Cheating, plagiarism, or unfair practice = **immediate disqualification.** Organisers may verify a project was built inside the event window.

**Practical implication for the phase prompts below:** anything scaffolded in Phases 0–5 outside the actual event window (e.g. built ahead of time while planning) should be treated as preparation/reference, not submittable code — the team should be ready to re-run the relevant phases live during the actual 25-hour hacking window so the repo's commit history genuinely reflects in-event work, per the organisers' verification right.

---

## 7. Judging

- **Two scored evaluation rounds** (Saturday evening, Sunday morning) **plus a Top 10 final pitch** — demo on the iQOO phone.
- HackTracker supplies the phone-use and Office Kit scores; the jury scores product quality, novelty, depth, and pitch.

### Scoring weights (100% total)

| Dimension | Weight | Scored by | What it measures |
|---|---|---|---|
| End product quality | **30%** | Jury panel | Does it work, is it useful, would someone keep using it |
| Novelty and impact | **20%** | Jury panel | Originality and real-world impact |
| HackTracker · creative phone use | **15%** | Device data | Camera, voice, on-device AI in the build |
| Technical depth | **15%** | Jury panel | Architecture, code quality, robustness, real use of the hardware |
| HackTracker · Office Kit usage | **10%** | Device data | Phone ↔ laptop bridge use |
| Demo and presentation | **10%** | Jury panel | A compelling 3–5 minute pitch |

- **Top 6 teams per city** advance to the Grand Finale in Bengaluru (9–11 Oct 2026): 3 student teams + 3 working-professional teams. The Finale itself runs 48 hours, Friday evening to Sunday evening. Standout teams beyond the Top 6 can also earn Finale slots, and teams can register directly for the Grand Finale without going through a city battle.

### How Whisper Slate maps to the rubric

| Weight | Whisper Slate's angle |
|---|---|
| End product quality (30%) | The full loop — whisper → transcribe → embed → sync → cluster → re-teach dashboard — needs to work live, end to end, on real devices, not just in isolated demos. |
| Novelty/impact (20%) | "Doubts don't need to be loud to be heard" — the anonymous, real-time, on-device re-teach signal is the novelty hook for the pitch. |
| Creative phone use (15%) | Voice capture (mic) + fully on-device AI (Whisper + MiniLM running on-NPU where possible) is a strong, legitimate fit — no gaming needed, just make sure it's real and HackTracker can see genuine usage. |
| Technical depth (15%) | On-device ONNX Runtime Web inference, local-subnet FastAPI sync, agglomerative clustering tuned for small noisy sets, escalating moderation logic — all real architecture to highlight. |
| Office Kit usage (10%) | Needs a genuine, designed-in reason to use screen mirror / clipboard / file transfer / remote control during the build and the demo (see Phase 6 below) — not an afterthought. |
| Demo (10%) | A tight 3–5 minute, phone-first pitch — see Phase 9 below. |

---

## 8. Submission Logistics

- Register/submit via **`https://iqoo.reskilll.com`**; full rules and guide at **`https://iqoo.reskilll.com/guide`**.
- Submit repo + demo assets before the hard cutoff (repos lock before Top 10 pitches).
- Keep the loaner iQOO phone within the venue/hacking zone at all times; return it before exit.
