# BlueTeamers Arena — API Versioning & Changelog

This document tracks API version changes, deprecation schedules, and backwards compatibility guarantees across `/api/v1/` and `/api/v2/`.

---

## 📌 API Versioning Policy

- **Current Stable Version**: `v1` (`/api/v1/`)
- **Experimental / Extended Version**: `v2` (`/api/v2/`)
- **Deprecation Notice**: APIs in `v1` will receive a minimum 12-month deprecation notice before sunsetting.

---

## 🚀 Version History

### Version 1.1.0 — September 2026
- **⚠️ BREAKING — Leaderboard security & privacy hardening** (`/api/v1/leaderboard/`, `/api/v1/leaderboard/current/`):
  - Authentication is now **REQUIRED**; the response is always scoped to the authenticated participant's own event. The `event_id`, `event_code` and `search`-by-email client parameters are **ignored** (removes cross-event data exposure / BOLA via `event_code`).
  - Rows are PII-minimal: `rank`, `name`, `score`, `completed`, `time_taken`, `is_current_user`, `is_finished` only. **Removed:** `participant_id`, `email` (masked or otherwise), per-row `college_name` / `event_code` (still present once at payload top level).
  - `search` matches **names only** (email search removed to prevent participation-enumeration oracle).
  - Participants of `Completed` events may still view final standings via the leaderboard (dedicated `LeaderboardTokenAuthentication`); all other endpoints still require a `Live` event.
- **WebSocket live leaderboard** (`ws(s)://<host>/ws/leaderboard/<event_code>/`):
  - Auth: client sends `{"token": "<jwt>"}` as the first message after connecting; access is limited to participants of that event (admins may use `global`).
  - Pushes: `{"type": "leaderboard_update", "data": <full leaderboard payload>}` — fired on every accepted submission and by Celery Beat (`refresh-live-leaderboards-every-minute`) as a safety net. Payloads are event-wide (no student context): clients overlay their own `is_current_user` row from their REST poll.
  - Deployment: `channels`, `channels-redis`, `daphne`, `uvicorn[standard]` added to requirements. The server now runs ASGI — the Dockerfile CMD / Procfile `web:` process is `gunicorn config.asgi:application -k uvicorn.workers.UvicornWorker`, which serves HTTP **and** WebSockets from one process (the previous WSGI CMD silently dropped WebSocket traffic). `REDIS_URL` must be set in production for the Redis channel layer.

### Version 1.0.0 (Stable) — July 2026
- **Auth**: Admin JWT Authentication (`/api/v1/auth/login/`, `/token/refresh/`, `/logout/`, `/me/`).
- **Events**: Event management & code verification (`/api/v1/events/verify-code/`).
- **Participants**: Student registration & profile management (`/api/v1/participants/register-student/`).
- **Questions**: Question Bank CRUD with MCQ & Text prompt validation (`/api/v1/questions/`).
- **Challenges**: CTF scenario workspace, multi-format evidence files (`TXT`, `LOG`, `JSON`, `CSV`, `PNG`), and stripped public questions (`/api/v1/challenges/`).
- **Submissions & Auto-Grading**: Automatic answer grading, regex pattern matching, keyword checks, score calculation (`/api/v1/challenges/{slug}/submit/`).
- **Leaderboard**: Real-time ranking (`score` DESC, `time` ASC), top 3 podium, student rank lookup (`/api/v1/leaderboard/`).
- **Dashboard & Progress**: Dashboard metrics (`/api/v1/dashboard/`) and draft answer autosaving (`/api/v1/progress/{slug}/save-draft/`).
- **Admin & Audit**: Platform analytics dashboard, CSV report exports, and security audit logging (`/api/v1/admin/dashboard/`, `/audit-logs/`).

### Version 2.0.0 (Experimental) — July 2026
- Namespace `/api/v2/` added for future extended microservice integrations and webhooks.
