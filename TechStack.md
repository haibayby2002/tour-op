Given your preference for **Django + React**, I would build Tour-op as a **modular monolith first**, with one backend serving both web and mobile. You don't need microservices for the initial platform.

## Recommended stack

```text
                         TOUR-OP
                            │
             ┌──────────────┴──────────────┐
             │                             │
          WEB APP                      MOBILE APP
             │                             │
       React + TS                  React Native + TS
             │                             │
             └──────────────┬──────────────┘
                            │
                         REST API
                            │
                    Django + DRF
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   PostgreSQL            Redis              Celery
        │                   │                   │
     PostGIS          Cache / realtime       Workers
        │
   Object Storage
        │
   Images / evidence

             ┌─────────────────────────┐
             │   External Services      │
             ├─────────────────────────┤
             │ Email                   │
             │ Push notifications      │
             │ Maps                    │
             │ Payment                 │
             │ Identity verification*  │
             └─────────────────────────┘
```

`*` only when you actually introduce those features.

---

# 1. Web: React + TypeScript

I'd use:

**React + TypeScript + Vite**

rather than making Django render the entire frontend.

```text
React
TypeScript
Vite
React Router
TanStack Query
React Hook Form
Zod
```

### Why

Your application is highly interactive:

* profile completion
* matching
* messaging
* booking
* reviews
* safety
* admin dashboard

That's a much better fit for a SPA-style React application.

### State management

Don't immediately introduce Redux.

Use:

```text
TanStack Query
        +
React local state
        +
Context where appropriate
```

TanStack Query handles:

```text
API data
cache
loading
error
refetch
pagination
optimistic updates
```

while React state handles UI state.

---

# 2. Mobile: React Native + TypeScript

Because you already prefer React, I'd strongly recommend:

**React Native + Expo + TypeScript**

rather than Flutter or native Swift/Kotlin for the first version.

```text
                 Shared concepts
                       │
             ┌─────────┴─────────┐
             │                   │
           React              React Native
             │                   │
            Web               iOS / Android
```

You won't literally share every component, but you can share:

* TypeScript types
* API client
* validation schemas
* business logic
* constants
* authentication logic
* data models

Potential monorepo:

```text
tour-op/
├── apps/
│   ├── web/
│   └── mobile/
│
├── packages/
│   ├── api-client/
│   ├── types/
│   ├── validation/
│   └── config/
│
└── backend/
    └── django/
```

This is a very good fit for your preference for TypeScript while keeping Django as the backend.

---

# 3. Backend: Django + Django REST Framework

This is where I think your preference is particularly appropriate.

```text
Django
Django REST Framework
PostgreSQL
```

I'd structure Django by **business domain**, not by technical layer.

```text
backend/
└── apps/
    ├── accounts/
    ├── profiles/
    ├── verification/
    ├── discovery/
    ├── matching/
    ├── services/
    ├── bookings/
    ├── messaging/
    ├── reviews/
    ├── safety/
    ├── disputes/
    ├── notifications/
    └── audit/
```

For example:

```text
bookings/
├── models.py
├── serializers.py
├── views.py
├── permissions.py
├── services.py
├── selectors.py
├── urls.py
└── tests/
```

This keeps the Django project maintainable as Tour-op grows.

---

# 4. API: REST first

I recommend:

```text
React
   │
   │ HTTPS / JSON
   ▼
Django REST Framework
```

rather than GraphQL initially.

For example:

```text
GET    /api/v1/profile/me
PATCH  /api/v1/profile/me

GET    /api/v1/locals
GET    /api/v1/locals/{id}

POST   /api/v1/tour-requests
GET    /api/v1/tour-requests/{id}

POST   /api/v1/bookings
PATCH  /api/v1/bookings/{id}

GET    /api/v1/conversations
GET    /api/v1/conversations/{id}/messages
POST   /api/v1/conversations/{id}/messages

POST   /api/v1/reviews
POST   /api/v1/disputes
```

Version it from day one:

```text
/api/v1/...
```

That gives you room for:

```text
/api/v2/...
```

later.

---

# 5. PostgreSQL + PostGIS

This is my strongest database recommendation.

```text
PostgreSQL
     +
PostGIS
```

Tour-op is inherently geographic:

```text
Traveler
    ↓
Destination
    ↓
Local
    ↓
Experience
```

Eventually you will want queries like:

> Find locals within 5 km.

or:

> Find experiences around District 1.

PostGIS makes this a natural database operation instead of forcing you to implement geographic calculations yourself.

Your model could eventually contain:

```text
local_profiles
---------------
location GEOGRAPHY(Point, 4326)
```

Then:

```text
Traveler location
       ↓
PostGIS
       ↓
Nearby locals
```

---

# 6. Redis

I'd introduce Redis fairly early.

Use it for:

```text
Redis
├── caching
├── rate limiting
├── temporary sessions/state
├── realtime infrastructure
└── Celery broker
```

Don't use Redis as your primary database.

PostgreSQL remains the source of truth.

---

# 7. Realtime messaging

This is one place where Tour-op differs from a normal CRUD application.

You need:

```text
Traveler
     ↕
 realtime messaging
     ↕
Local
```

I'd use:

**Django Channels + WebSockets**

Architecture:

```text
React Native / React
        │
        │ WebSocket
        ▼
Django Channels
        │
      Redis
        │
    PostgreSQL
```

REST handles:

```text
Create booking
Get profile
Submit review
Open dispute
```

WebSocket handles:

```text
New message
Typing indicator
Online/offline
Message delivered/read
Booking event
Safety notification
```

---

# 8. Background jobs: Celery

Use:

**Celery + Redis**

for things that shouldn't block HTTP requests.

Examples:

```text
User uploads profile
        ↓
Django
        ↓
Celery
 ├── process image
 ├── update profile completion
 ├── send email
 ├── send notification
 └── update search index
```

Other examples:

* email verification
* notification delivery
* review reminders
* booking reminders
* image processing
* reputation calculations
* scheduled cleanup
* external-data synchronization

---

# 9. File storage

Don't store images inside PostgreSQL.

Use object storage:

```text
S3-compatible storage
```

For example:

```text
Profile photos
Verification documents
Service photos
Dispute evidence
```

Database stores:

```text
storage_key
```

rather than the binary file.

Architecture:

```text
Mobile/Web
    │
    ▼
Django
    │
    ├──────────────► PostgreSQL
    │
    └──────────────► Object Storage
```

For your preference for cheap infrastructure, an S3-compatible provider is preferable to building your own file server.

---

# 10. Authentication

For your system, I'd separate:

### Authentication

```text
Email
Password
OAuth
```

### Verification

```text
Email verification
Phone verification
Identity verification
```

These are **not the same thing**.

The database should therefore have:

```text
users
```

and separately:

```text
verifications
```

which fits the ERD we discussed.

For mobile, use access/refresh tokens rather than treating the mobile app like a browser session.

---

# 11. Maps

Because Tour-op is location-centric, you'll eventually need a map provider.

The abstraction should be:

```text
Tour-op
   │
   ▼
MapService interface
   │
   ├── Geocoding
   ├── Reverse geocoding
   ├── Map display
   └── Directions
```

Don't tightly couple your business logic to a single map provider.

For example:

```text
services/
    maps/
        interface.py
        provider.py
```

That makes changing providers later much easier.

---

# 12. Notifications

You need three levels:

```text
                 Notification
                      │
          ┌───────────┼───────────┐
          │           │           │
        In-app       Push        Email
```

Examples:

### In-app

> Your booking request was accepted.

### Push

> Local Nguyễn A accepted your request.

### Email

> Verify your email address.

For mobile:

```text
React Native
     ↓
Push Notification Service
     ↓
iOS / Android
```

Don't make email your primary realtime communication mechanism.

---

# 13. Admin application

Don't build a completely separate admin backend initially.

Django Admin is actually extremely useful for Tour-op.

Use it for:

```text
Users
Profiles
Verifications
Bookings
Reports
Disputes
Reviews
Audit logs
```

Then later build a dedicated:

```text
React Admin Dashboard
```

when operations become complicated.

So:

```text
             Django Backend
                    │
        ┌───────────┴───────────┐
        │                       │
    Django Admin            REST API
                                │
                       ┌────────┴────────┐
                       │                 │
                      Web              Mobile
```

This saves a lot of development time.

---

# 14. Recommended infrastructure

For your preference of relatively inexpensive infrastructure:

```text
Cloudflare
    │
    ├── DNS
    ├── CDN
    └── WAF
          │
          ▼
      React Web
          │
          ▼
     Django API
          │
    ┌─────┼───────────┐
    │     │           │
Postgres Redis      Object Storage
    │     │
    │   Celery
    │
    └──────────────┐
                   │
             Django Channels
```

Everything can initially run in Docker.

---

# 15. Docker

I'd use Docker from day one:

```text
docker-compose.yml

services:
  web
  api
  postgres
  redis
  worker
```

Development:

```text
React
Django
PostgreSQL
Redis
Celery
```

Production can then use the same conceptual architecture.

You don't need Kubernetes.

---

# 16. Testing

I'd use:

### Backend

```text
pytest
pytest-django
```

Test especially:

```text
Booking state transitions
Permissions
Messaging permissions
Dispute permissions
Review rules
Profile visibility
```

### Frontend

```text
Vitest
React Testing Library
```

### End-to-end

```text
Playwright
```

The most important E2E test isn't:

> "Can I open the homepage?"

It's:

```text
Traveler registers
       ↓
Completes profile
       ↓
Creates request
       ↓
Local receives request
       ↓
Local accepts
       ↓
Conversation created
       ↓
Booking confirmed
       ↓
Tour completed
       ↓
Both review each other
```

That's your **critical business flow**.

---

# 17. Monorepo

I'd use:

```text
tour-op/
│
├── apps/
│   ├── web/
│   └── mobile/
│
├── packages/
│   ├── api-client/
│   ├── shared-types/
│   └── validation/
│
├── backend/
│   └── django/
│
├── infrastructure/
│   ├── docker/
│   └── deployment/
│
└── docs/
```

For JavaScript package management:

```text
pnpm
```

is a good fit.

You can share:

```text
packages/shared-types
```

between:

```text
React
React Native
```

while Django maintains the authoritative server-side model.

---

# 18. The stack I'd actually choose for you

If **I were building the first production-capable version of Tour-op with your constraints/preferences**, I'd choose:

| Layer             | Technology                                               |
| ----------------- | -------------------------------------------------------- |
| Web               | **React + TypeScript + Vite**                            |
| Mobile            | **React Native + Expo + TypeScript**                     |
| API               | **Django + Django REST Framework**                       |
| Realtime          | **Django Channels + WebSocket**                          |
| Database          | **PostgreSQL + PostGIS**                                 |
| Cache             | **Redis**                                                |
| Background jobs   | **Celery**                                               |
| File storage      | **S3-compatible object storage**                         |
| Web auth          | HTTP-only secure cookies / appropriate session mechanism |
| Mobile auth       | Access + refresh tokens                                  |
| API data fetching | **TanStack Query**                                       |
| Forms             | **React Hook Form + Zod**                                |
| Web routing       | **React Router**                                         |
| Mobile navigation | **Expo Router**                                          |
| Testing           | **pytest + Vitest + Playwright**                         |
| Containers        | **Docker**                                               |
| Reverse proxy/CDN | **Cloudflare**                                           |
| Admin             | **Django Admin → custom React Admin later**              |
| Maps              | Provider abstraction + PostGIS                           |
| CI/CD             | **GitHub Actions**                                       |

---

## 19. One architectural decision I'd make very strongly

Don't build:

```text
                 Microservices
                 /    |     \
             User   Booking  Chat
              │       │       │
            DB      DB       DB
```

for the first version.

Build:

```text
                 TOUR-OP
                    │
             Django Monolith
                    │
       ┌────────────┼────────────┐
       │            │            │
    Accounts     Booking      Messaging
    Profiles     Matching     Safety
    Reviews      Disputes    Verification
                    │
              PostgreSQL
```

**Modular monolith ≠ bad architecture.**

For Tour-op, it's actually a strong starting point because your core workflows are tightly related:

```text
Profile
  ↓
Matching
  ↓
Booking
  ↓
Messaging
  ↓
Tour
  ↓
Review
  ↓
Reputation
  ↓
Dispute
```

You want those transactions to be easy to reason about.

Later, if messaging or matching becomes independently scalable, you can extract it:

```text
Django Core
    │
    ├── Matching Service
    ├── Messaging Service
    └── Notification Service
```

without rewriting the entire platform.

### Bottom line

Your preferred **Django + React** stack is a very good fit. I'd extend it to **Django + DRF + PostgreSQL/PostGIS + Redis/Celery/Channels + React Web + React Native**, with Docker and a modular-monolith architecture.

The resulting platform is essentially:

**one backend + two clients + one relational source of truth**, with realtime communication layered on top.
