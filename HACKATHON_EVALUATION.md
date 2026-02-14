# MoraLai — Hackathon Evaluation & Win Strategy

A frank assessment of where the project stands and **what to add to win**.

---

## What You Already Have (Strengths)

| Area | What’s there |
|------|----------------|
| **Problem** | Clear: student mental health check-in, campus wellness. Judges get it. |
| **Tech** | Modern stack: React/Vite, Express/TS, Gemini, ElevenLabs (voice), SQLite, Docker. |
| **Core flow** | Login → Welcome → Chat (voice + text) → AI assessment → Results → Support plan. Form fallback when AI is down. |
| **Safety** | Scope-limited AI (wellness only), follow-up prompts, helpline link, no technical errors shown to users. |
| **Admin** | Student list from DB, risk/score/last assessed, modals. Auth (JWT, roles). |
| **UX** | Friendly copy, risk ring chart, concerns/keywords, follow-up section, Support Plan with tasks. |

---

## Where Judges Will Look (and Where You’re Short)

Hackathon criteria usually boil down to: **Impact**, **Innovation**, **Execution**, **Presentation**.

### 1. Impact — “So what? Who does this help?”

- **Gap:** Right now it feels like “a demo.” No clear **number** or **story**: e.g. “Piloted at X students,” “Reduces time to first check-in by Y,” “Advisors use it to prioritize Z.”
- **Gap:** “University of Morocco” is hardcoded; no sense of **deployability** to real campuses (configurable school name, timezone, or “campus ID”).

**Add:**  
- One **impact slide** with a concrete scenario: e.g. “1 counselor for 3,000 students → MoraLai triages check-ins; high-risk students surface in admin in &lt;2 min.”  
- Optional: **Config** (school name, optional campus/country) so it looks “deployable,” not single-university.

### 2. Innovation — “What’s new or clever?”

- **Current:** Gemini + ElevenLabs + form fallback is solid but not *surprising*. Many apps do “chat + assessment.”
- **Gap:** No clear **differentiator** that judges can quote: e.g. “First to combine voice-first check-in + structured risk + admin triage in one flow,” or “AI that refuses to go off-topic.”

**Add:**  
- **One sharp differentiator** you can state in one sentence and demo in 30 seconds:
  - **Option A — Voice-first:** “Only check-in that starts with the AI *speaking* and supports full voice conversation (TTS + STT).” (You already have it; **name it** and lead the demo with it.)
  - **Option B — Triage:** “Admins see risk trends and who to follow up with first, not just raw chat logs.” (Needs real dashboard data — see Execution.)
  - **Option C — Resilience:** “When the AI is down, students still complete a form and get the same follow-up and helpline — no dead end.” (You have it; **call it out** in the pitch.)

### 3. Execution — “Does it actually work end-to-end?”

- **Admin dashboard uses mock data:** Low/Medium/High counts (672, 187, 33), “+12 this week,” chart, and “5 students … critical risk” are **hardcoded**. Judges or technical evaluators will notice.
- **Risk:** “View Students” and charts don’t reflect real DB → undermines trust in “execution.”

**Add (high priority):**  
- **Real aggregates from DB:**  
  - Counts: students with latest assessment Low / Medium / High (and total active = students with ≥1 assessment).  
  - Simple “trend” (e.g. last 7 days: count of assessments per day, or avg risk score per day).  
- **Wire “Urgent Attention”** to real data: e.g. “Students with High risk in the last 24–48 hours” and make “View Students” open the list filtered or scroll to those.

### 4. Presentation — “Can they explain it in 2 minutes?”

- **Gap:** No single place that tells the story: problem → solution → demo → tech → impact. README is for devs; judges need a **pitch** (slide deck or a single “About / How it works” page in the app).
- **Gap:** Demo flow might not be obvious (e.g. “Start Conversation” vs “Daily Check-In” both go to chat; difference could be clearer).

**Add:**  
- **Pitch deck (5–7 slides):** Problem → Solution (one-liner + differentiator) → User flow (student + admin) → Tech (Gemini, ElevenLabs, SQLite, Docker) → Impact / next steps.  
- **Optional:** A “Judge mode” or “Demo” button: prefill a short conversation or auto-complete a check-in so you can show Results + Admin in under 2 minutes.

---

## Prioritized “What to Add to Win”

### Must-have (do first)

1. **Replace admin dashboard mock data with real DB data**  
   - Low/Medium/High counts from latest assessment per student.  
   - “Total active” = count of students with ≥1 assessment (or similar).  
   - “Urgent” = e.g. High risk in last 24–48h; “View Students” shows real list (or filters to high-risk).

2. **One clear “innovation” line and demo it**  
   - Pick one: **Voice-first check-in**, **Form fallback when AI is down**, or **Admin triage by risk**.  
   - State it in the opening of your pitch and show it in the first 60 seconds of the demo.

3. **One impact sentence + one “so what”**  
   - e.g. “One counselor can’t reach 3,000 students; MoraLai lets students check in in under 2 minutes and surfaces who needs follow-up first.”

### Should-have (if you have time)

4. **Pitch deck or in-app “How it works”**  
   - Problem, solution, user flow, tech stack, impact. Makes judging faster and more consistent.

5. **“View Students” / “Urgent” wired to real students**  
   - Click “View Students” → list or modal of real high-risk students from DB (by latest assessment and time window).

6. **Optional: Judge/demo shortcut**  
   - e.g. “Demo flow” that creates a sample assessment so you can jump straight to Results and Admin without typing a long chat.

### Nice-to-have (polish)

7. **Configurable “campus” or “school name”**  
   - One env var or config screen: school name (and maybe country). Shows “we thought about multi-campus.”

8. **Student-facing “Your check-in history”**  
   - List of past check-ins (date, risk level, “View” → same result view). Shows continuity of care.

9. **Export or report for admins**  
   - e.g. “Download last 7 days – high risk” (CSV or PDF). Strong for “deployable product” impression.

---

## Summary Table

| Priority | What | Why |
|----------|------|-----|
| **P0** | Real admin dashboard data (counts, urgent from DB) | Execution credibility; judges check “does it work?” |
| **P0** | One innovation line + 60s demo of it | Gives judges something to remember and quote |
| **P0** | One impact sentence (“so what?”) | Answers “why should we care?” |
| **P1** | Pitch deck or “How it works” | Clean, repeatable 2-minute story |
| **P1** | “View Students” / Urgent → real list | Closes the loop on “triage” |
| **P2** | Demo shortcut for judges | Saves time and avoids live API hiccups |
| **P2** | Campus/school config, history, export | Polish and “real product” feel |

---

## Bottom Line

- **Strong base:** Problem, stack, student flow, safety, and admin list are all there.  
- **Biggest risk:** Admin dashboard is **mock**; fixing that is the single highest-leverage execution fix.  
- **Biggest upside:** Naming and demonstrating **one** clear differentiator (voice-first, form fallback, or admin triage) and one **impact** line will make the project stick in judges’ minds.

If you only do three things: **(1) Real admin data, (2) One innovation sentence + demo, (3) One impact sentence** — you’ll be in a much stronger position to win.
