# Tour-op

Connects solo travelers and small groups (1–3 people) with trustworthy locals.
The product is built around **two-way trust**: verified contacts, honest and
separate trust signals, a written and versioned itinerary + price agreed
*before* the tour, in-app chat that blocks contact details, double-blind
reviews, and private reports.

Specs live in the root `*.md` files (PRD, system architecture, ERD, tech stack,
trust checklist).

```
tour-op/
├── backend/    Django 5 + DRF + Channels (WebSocket) + Celery — one modular monolith
├── frontend/   React 19 + TypeScript + Vite + TanStack Query + React Hook Form/Zod + i18next
├── mobile/     Expo SDK 57 + Expo Router + TypeScript
└── docker-compose.yml   Postgres/PostGIS, Redis, API, Celery worker + beat, web
```

Both clients are bilingual (Tiếng Việt / English).

## Quick start (no Docker)

The backend runs on SQLite, an in-memory channel layer and inline Celery when
`DATABASE_URL` / `REDIS_URL` are not set.

```bash
# API: http://127.0.0.1:8000  (admin at /admin, OpenAPI docs at /api/docs/)
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # macOS/Linux: .venv/bin/pip
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed_demo
.venv/Scripts/python manage.py runserver

# Web: http://localhost:5173  (proxies /api, /ws, /media, /admin to :8000)
cd frontend
npm install
npm run dev

# Mobile: scan the QR code with Expo Go (phone on the same Wi-Fi)
cd mobile
npm install            # .npmrc sets legacy-peer-deps (Expo 57 peer conflict)
npx expo start
```

The mobile app calls `http://<your-machine-ip>:8000` automatically. Set
`EXPO_PUBLIC_API_URL` to override. If you open it on a phone, run Django with
`runserver 0.0.0.0:8000`.

### Demo accounts (password `TourOps!2026`)

| Email | Role |
|---|---|
| `traveler@tour-op.local` | Traveler (Alex) |
| `linh@tour-op.local`, `minh@tour-op.local` | Locals, Ho Chi Minh City |
| `huong@tour-op.local` | Local, Hanoi |
| `tuan@tour-op.local` | Local, Da Nang |
| `mai@tour-op.local` | Local, Hoi An |
| `admin@tour-op.local` | Staff (Django admin) |

In development, verification codes are printed to the API console **and**
returned in API responses (`EXPOSE_VERIFICATION_CODES`), so the web/mobile
verify screens show them. This is turned off when `DJANGO_DEBUG=false`.

## Full stack with Docker

```bash
docker compose up --build
```

Web on http://localhost:5180, API on http://localhost:8010 (admin at `/admin`),
Postgres (PostGIS image) on 5433 and Redis on 6380, plus a Celery worker and beat
(request expiry, auto-completing finished tours). Host ports are chosen to avoid
other local stacks and can be overridden with `TOUROP_WEB_PORT`,
`TOUROP_API_PORT`, `TOUROP_DB_PORT` and `TOUROP_REDIS_PORT`.

## Tests

```bash
cd backend  && .venv/Scripts/python -m pytest      # 75 tests: flows, permissions, privacy, realtime, uploads
cd frontend && npx vitest run && npx tsc -b         # i18n parity/coverage + type check
cd mobile   && npm run typecheck
```

## How the core flow works

1. **Register** (name, birth year, email, phone are required) → verify email and phone.
   Both are required before sending *or* receiving requests.
2. **Explore**: rule-based matching, where each result explains *why* it matched
   (shared language/interests, availability, budget…). New members show
   "No reviews yet", never a low score.
3. **Request**: the traveler sends date, group size, budget, wishes and *things to avoid*.
   The local sees the traveler's profile and trust signals before deciding.
   **Or post a trip wish** (`/wishes`): the traveler describes the trip without
   choosing anyone, optionally with requirements (must speak X, must offer a
   category, minimum rating, checked-by-Tour-op only). A Celery task matches
   qualified locals **in that city** (active, verified, accepting requests, priced
   within budget, meeting every requirement), stores them as match candidates
   (top 30 by match score) and notifies them in-app, by push and by email. Matched locals
   (and only they) can see the wish and the traveler's preferences and send a short
   offer; locals never see competing offers. When the traveler picks one, a
   booking opens in the discussion stage; other offers are closed with a notice.
   Wishes expire at their start time.
4. **Accept to talk** opens a chat. **This is not a confirmation.**
5. **Agreement**: the local proposes a versioned itinerary + price with separate
   extra-cost fields. Shopping/food/partner stops are flagged and the traveler can
   decline them. The traveler must acknowledge the costs to accept → booking
   `CONFIRMED`. Accepted versions are immutable; any change is a new version the
   traveler must accept again.
6. **Tour**: start → complete (auto-completed 24 h after the end time). The traveler
   can share a read-only trip link (no prices or contacts) with family.
7. **Reviews** are two-way, tied to the completed booking, and double-blind: they
   are published when both sides have reviewed or after 14 days.
8. **Reports** are private (the reported person can't see or delete them), accept
   evidence uploads, can open a dispute, and are handled in Django admin. Staff
   views of conversations and reports are audit-logged.

### Contact-detail protection

`backend/apps/common/contact_filter.py` scans profile text, request notes,
agreements, reviews and every chat message. Phone numbers (incl. separators and
digits spelled out in English/Vietnamese) and emails (incl. `(at)`/`(dot)`) are
**blocked**; blocked messages are kept as evidence but never delivered. Links,
social handles and "add me on Zalo"-style invitations get a **warning**. No filter
catches everything, and the UI says so.

## Configuration

See `backend/.env.example`, `frontend/.env.example`, `mobile/.env.example`.
Notable settings: `MAX_GROUP_SIZE` (3), `MIN_USER_AGE` (18),
`REQUIRE_CONTACT_VERIFICATION`, file storage via `MEDIA_STORAGE` (see below),
`EXPO_PUBLIC_API_URL`, and `EXPO_PUSH_ENABLED` (push also needs an
EAS project id in `app.json`).

Shared API types and translations are authored in `frontend/src` and copied
to mobile with `npm run sync:shared` (inside `mobile/`).

## Decisions made where the specs left things open

Change these if the founders decide differently:

- One account can hold both roles (Traveler + Local), as the architecture doc assumed.
- No payments in the MVP; price is agreed and recorded, not collected.
- Minimum age 18 by birth year; max group size 3.
- Identity verification exists only as a staff-set status (manual document check in admin);
  email/phone verification is never labelled as identity.
- External reviews are links/screenshots shown as **unverified** until staff check them.
- Unanswered requests expire after 72 h; reviews can be written for 30 days.
- Geo search uses city + availability. The schema is PostGIS-ready, but
  distance queries aren't implemented yet; `apps/common/maps` is the provider abstraction.

## Photos and file storage

Avatars, gallery photos, experience photos and review screenshots are
re-encoded on upload (`apps/common/images.py`): the file must really be a
JPEG/PNG/WebP, EXIF metadata (including GPS location) is dropped, the camera
rotation is applied, and the result is stored as WebP (max 1600 px, plus a
480 px thumbnail for grids). Storage keys are random (`profile_photos/2026/10/<uuid>.webp`);
original filenames are never kept. Files are deleted when their row is deleted
or replaced.

Where files live is one env var (`backend/.env`, details in `.env.example` and
`backend/config/storage.py`):

| `MEDIA_STORAGE` | Needs |
|---|---|
| `local` (default) | nothing; files in `backend/media/`. `SERVE_MEDIA=true` lets Django serve them with `DEBUG` off |
| `r2` | `R2_ACCOUNT_ID`, `MEDIA_BUCKET`, `MEDIA_ACCESS_KEY_ID`, `MEDIA_SECRET_ACCESS_KEY`, optionally `MEDIA_PUBLIC_URL` (custom domain / r2.dev) |
| `s3` | `MEDIA_BUCKET`, `MEDIA_REGION`, credentials (or an IAM role), optionally `MEDIA_PUBLIC_URL` (CloudFront) |

Report evidence uses a separate `private` storage that is always served
through short-lived signed URLs on S3/R2. Use a bucket without public access
for it (`MEDIA_PRIVATE_BUCKET`). The database stores only keys, so moving from
local disk to R2 means copying `backend/media/` into the bucket with the same
paths (e.g. `rclone copy backend/media r2:tourop-media`) and changing the env.
