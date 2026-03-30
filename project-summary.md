# ScholarIDE — Project Overview

## What is ScholarIDE?

ScholarIDE is a **sandboxed, integrity-first code editor** built as a desktop application using Electron. Its core purpose is to **prevent students from using unauthorized AI tools** (ChatGPT, GitHub Copilot, external editors, etc.) during coding assignments — while still providing a genuinely good IDE experience with a controlled, instructor-approved AI tutor built in.

Students write all their code inside ScholarIDE. The workspace is cryptographically guarded: any file edits made by external programs (VS Code, vim, a terminal outside the app) are automatically detected and reverted. All work is saved to the student's cloud account via Supabase, giving instructors a verifiable record of what was written and when.

The AI Tutor is powered by a **dedicated backend server** that proxies Claude's API with a strict system prompt — it can only give hints and nudges, never complete answers or written code. Students get the benefit of AI assistance without the ability to just ask for solutions.

### Core Value Proposition

> **For instructors:** Know that student code was actually written by the student, inside a controlled environment, with no unauthorized AI assistance.
>
> **For students:** A familiar VS Code-like experience with a built-in AI tutor that teaches through guidance — not code handouts.

---

### Key Features

| Feature | Status |
|---------|--------|
| Monaco Editor (VS Code engine) | ✅ Built |
| File Explorer (tree view) | ✅ Built |
| Sandboxed terminal (zsh/powershell) | ✅ Built |
| External edit detection & revert | ✅ Built |
| Built-in AI Tutor panel | ✅ Built |
| Supabase Authentication | ✅ Built |
| Cloud file storage (workspace sync) | ✅ Built |
| Dedicated AI backend (Claude API) | 🔜 Planned |
| Hints-only system prompt enforcement | 🔜 Planned |
| Session / audit logging | 🔜 Planned |
| Instructor dashboard | 🔜 Planned |
| Assignment management | 🔜 Planned |
| Real-time session monitoring | 🔜 Planned |
| AI usage audit trail | 🔜 Planned |

---

## System Design

![System Architecture](./system_design.png)

### Technology Breakdown

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 40 |
| UI framework | React 19 + TypeScript |
| Code editor | Monaco Editor |
| File tree | react-arborist |
| Terminal emulator | xterm.js + node-pty |
| Bundler | Webpack (Electron Forge) |
| Auth + Storage + DB | **Supabase** |
| AI backend | **Dedicated server → Anthropic Claude API** |
| Git integration | isomorphic-git |

### How the Sandbox Works

The main process runs a **File Watcher + Snapshot Guard** that:
1. Takes an MD5 hash snapshot of every file in the workspace on startup
2. Watches for any filesystem change events
3. If a change was NOT triggered internally by ScholarIDE → it is immediately reverted and the student is alerted
4. The terminal is sandboxed to the workspace directory — `cd` outside it is blocked

### Supabase Integration

```
Student logs in (email/password or OAuth)
    ↓
Supabase Auth → session token
    ↓
Workspace files downloaded from Storage (workspaces/{user_id}/)
    ↓
Every file save → uploaded to Storage
    ↓ (future)
Edit events → logged to Database (audit trail)
```

### AI Backend — Hints-Only Claude Proxy

The current AI tutor hits `localhost:1234` (a local dev server). The planned production backend replaces this with a hardened API server that:

1. **Authenticates the request** using the student's Supabase JWT — no anonymous queries
2. **Injects a strict system prompt** before every Claude API call, e.g.:
   > *"You are a coding tutor. Never write code for the student. Never give complete solutions. Always respond with guiding questions, conceptual explanations, and small hints that help the student figure out the answer themselves."*
3. **Logs every query and response** to the `ai_interactions` table in Supabase with the student ID, timestamp, and full message history
4. **Rate-limits** per student to prevent abuse
5. **Supports instructor overrides** — per-assignment config can disable the tutor entirely or tighten the system prompt further

```
Student types question in AI Tutor panel
    ↓
ScholarIDE → POST /api/ai/chat  (with Supabase JWT)
    ↓
Backend validates JWT → fetches assignment config from DB
    ↓
Injects hints-only system prompt + student message
    ↓
Anthropick Claude API (claude-3-5-sonnet)
    ↓
Response returned + logged to ai_interactions table
    ↓
Hint displayed in AI Tutor panel
```

---

## ERD — Data the Project Uses

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│    Supabase Auth (users)        │   │   Supabase Storage              │
│─────────────────────────────────│   │─────────────────────────────────│
│ id (uuid)                       │   │ workspaces/                     │
│ email                           │   │   {user_id}/                    │
│ created_at                      │   │     welcome.md                  │
│ last_sign_in_at                 │   │     project/                    │
└─────────────────────────────────┘   │       main.py                   │
         │                            └─────────────────────────────────┘
         │ (future)
         ▼
┌─────────────────────────────────┐
│   audit_logs (Supabase DB)      │   ← PLANNED
│─────────────────────────────────│
│ id                              │
│ user_id → auth.users            │
│ file_path                       │
│ event_type (open/save/run/ai)   │
│ content_snapshot                │
│ timestamp                       │
└─────────────────────────────────┘
         │
         │ belongs to
         ▼
┌─────────────────────────────────┐
│   assignments (Supabase DB)     │   ← PLANNED
│─────────────────────────────────│
│ id                              │
│ instructor_id → auth.users      │
│ title                           │
│ description                     │
│ due_at                          │
│ ai_tutor_allowed (bool)         │
│ ai_system_prompt (text)         │
└─────────────────────────────────┘
         │
         │ referenced by
         ▼
┌─────────────────────────────────┐
│  ai_interactions (Supabase DB)  │   ← PLANNED
│─────────────────────────────────│
│ id                              │
│ user_id → auth.users            │
│ assignment_id → assignments     │
│ role (user / assistant)         │
│ content (text)                  │
│ timestamp                       │
└─────────────────────────────────┘
```

---

## Future Plans

### 1. Dedicated AI Backend (Claude API)
Replace the local dev server with a production backend (Node.js/Express or similar) that:
- Authenticates every request via Supabase JWT
- Enforces a **hints-only system prompt** — Claude is instructed never to write code for the student
- Supports per-assignment system prompt overrides set by the instructor
- Logs every interaction to the `ai_interactions` table
- Rate-limits students to prevent flooding the API

### 2. Audit Logging
Every meaningful event (file save, AI query, terminal command, file run, integrity violation) written to `audit_logs` with a timestamp and content snapshot. Instructors can replay a student's full coding session chronologically.

### 3. Instructor Dashboard (web app)
A separate Next.js web app where instructors can:
- Create and distribute coding assignments
- View all student submissions and workspace snapshots
- Browse audit logs and session replays
- Read full AI tutor conversation history per student
- Configure per-assignment rules (AI disabled, custom system prompt, due date)

### 4. Real-Time Monitoring (Supabase Realtime)
Live view of active student sessions during exams — instructors see which files are open, last save time, and any integrity violations in real time.

### 5. Assignment Distribution
Instructors create assignments with starter files → distributed to student workspaces via Supabase Storage. Students open an assignment and their workspace is pre-populated.

### 6. AI Usage Audit
Full AI tutor logs stored in `ai_interactions`. Instructors can see every question a student asked and every hint Claude gave — making it easy to spot if a student tried to extract answers by rephrasing.

---

## Daily Goals

| Date | Goal |
|------|------|
| Feb 10, 2026 | ✅ Initial setup — text editor, file explorer, terminal |
| Feb 11, 2026 | ✅ App builds and opens files; terminal cwd tracking; block external edits |
| Feb 12, 2026 | ✅ Workspace-only IDE; clean terminal; AI agent panel; AI tutor working |
| Mar 30, 2026 | ✅ Agent fixes; Supabase auth + file storage integrated |
| Mar 31 | Build dedicated AI backend server skeleton (Express + Claude API) |
| Apr 1 | Implement hints-only system prompt + JWT auth on backend |
| Apr 2 | Add `ai_interactions` logging to DB; add audit_logs for file saves |
| Apr 3 | Add multi-tab editor + git status indicators in file explorer |
| Apr 6 | Build instructor dashboard (Next.js) — auth, student list, AI log viewer |
| Apr 7 | Instructor dashboard — audit log viewer / session replay |
| Apr 8 | Assignment system — create, assign, distribute starter files |
| Apr 9 | Polish UI + write README + record demo |
| Apr 10 | **Final presentation / submission** |
