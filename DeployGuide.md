# Tour-op MVP — Deployment & Cost Specification

## 1. Objective

Deploy the Tour-op MVP with:

* Web application
* Android mobile application
* Django backend API
* PostgreSQL database
* Google authentication
* User avatars and profile images
* Local/service images
* Review images
* Real-time chat
* Android publication on Google Play
* Architecture that can later scale to approximately 5,000 users

The MVP should prioritize **low operating cost, simplicity, security, and easy migration/scaling**.

The application should be designed as a **modular monolith**, not microservices.

---

# 2. Recommended Architecture

```text
                         ┌─────────────────────┐
                         │      Users          │
                         └──────────┬──────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   │                                 │
                   ▼                                 ▼
          ┌─────────────────┐              ┌─────────────────┐
          │   Web Client    │              │ Android Client  │
          │ React + TS/Vite │              │ React Native    │
          └────────┬────────┘              │ + Expo          │
                   │                       └────────┬────────┘
                   │                                │
                   └──────────────┬─────────────────┘
                                  │ HTTPS
                                  ▼
                       ┌─────────────────────┐
                       │    Django API       │
                       │ Django REST         │
                       │ Framework           │
                       └──────────┬──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
       │ PostgreSQL  │     │    Redis    │     │ Cloudflare  │
       │             │     │             │     │     R2      │
       │ Application │     │ Cache /     │     │ Images      │
       │ data        │     │ Realtime    │     │             │
       └─────────────┘     └─────────────┘     └─────────────┘
              │
              ▼
       Users / Profiles
       Bookings
       Messages
       Reviews
       Trust data
```

---

# 3. Technology Stack

## Frontend Web

Use:

* React
* TypeScript
* Vite
* React Router
* TanStack Query
* React Hook Form
* Zod

Deployment:

* Cloudflare Pages

Do not use a paid frontend hosting service for the MVP unless there is a technical reason.

---

# 4. Mobile

Use:

* React Native
* Expo
* TypeScript
* Expo Router

Target:

* Android first
* iOS-compatible codebase, but do not publish to App Store during MVP unless explicitly requested

The Android application should consume the same Django REST API as the web application.

Avoid maintaining separate backend logic for mobile and web.

---

# 5. Backend

Use:

* Python
* Django
* Django REST Framework
* Django Channels for realtime communication
* Celery for background jobs if required
* Redis

Recommended backend structure:

```text
backend/
├── config/
├── apps/
│   ├── accounts/
│   ├── profiles/
│   ├── services/
│   ├── tour_requests/
│   ├── bookings/
│   ├── conversations/
│   ├── reviews/
│   ├── media/
│   └── notifications/
├── requirements/
├── manage.py
└── tests/
```

Use a modular Django monolith.

Do NOT create microservices for the MVP.

---

# 6. Database

Use:

* PostgreSQL

Prefer PostgreSQL over MySQL.

If geographic search is required, use:

* PostGIS

The database should contain metadata about uploaded images but should NOT store image binaries.

Example:

```text
review_images
-------------------------
id
review_id
storage_key
mime_type
width
height
file_size
created_at
```

Actual image files should be stored in object storage.

---

# 7. Authentication

Use Google OAuth / Google Sign-In.

Recommended architecture:

```text
Google
   ↓
Authentication
   ↓
Django
   ↓
users table
```

Google authentication should NOT replace Tour-op user records.

After authentication, Django should maintain its own:

```text
User
Profile
Roles
Verification status
Booking history
Review history
```

A user may eventually have both roles:

```text
TRAVELER
LOCAL
```

Do not create completely separate authentication systems for travelers and locals.

---

# 8. User Information

Required account information:

```text
email
phone
full_name
birth_year
```

Important:

* Email and phone must NOT be publicly displayed.
* Do not expose private contact information through public APIs.
* Users should communicate through the Tour-op application.
* Public profile should show only appropriate profile information.

Public profile may contain:

```text
display_name
age
bio
abilities
languages
interests
profile images
reviews
experience
verification indicators
```

---

# 9. Image Upload System

The MVP must support:

### Avatar

One primary avatar per user.

### Profile images

Allow users to upload several profile images.

Suggested MVP limit:

```text
5–10 images per profile
```

### Local/service images

Allow local users to attach images to their services.

Suggested limit:

```text
5–10 images per service
```

### Review images

Allow users to attach images to completed-tour reviews.

Suggested limit:

```text
3–5 images per review
```

---

# 10. Image Storage

Use:

**Cloudflare R2**

Do NOT store uploaded images in:

* PostgreSQL
* Django local filesystem
* application server disk

Architecture:

```text
Client
   ↓
Django
   ↓
Signed upload / authorized upload
   ↓
Cloudflare R2
```

Database stores only image metadata and storage keys.

Example:

```text
PostgreSQL

profile_images
-------------------------
id
user_id
storage_key
mime_type
width
height
file_size
sort_order
created_at
```

R2 should contain the actual files.

---

# 11. Image Processing

Accepted formats:

```text
JPEG
PNG
WebP
```

Recommended maximum upload size:

```text
5 MB/image
```

Images should be resized/compressed before or during storage.

Recommended variants:

### Avatar

```text
128x128
256x256
512x512
```

### Profile/service/review image

```text
640px
1280px
original
```

Do not serve unnecessarily large original images to mobile users.

Use WebP/optimized formats where appropriate.

---

# 12. Review Image Relationship

Review images must belong to a legitimate review.

Recommended:

```text
Booking
   ↓
Review
   ↓
ReviewImage
   ↓
Cloudflare R2
```

A review should only be created for an eligible/completed booking.

This helps prevent fake reviews and supports the Tour-op trust model.

---

# 13. Real-Time Chat

MVP should support:

* Conversation creation
* Conversation members
* Text messages
* Message timestamps
* Read/unread status
* Basic message history

Use:

```text
Django Channels
+
Redis
+
WebSocket
```

Do not implement voice/video calls in the first MVP.

Do not expose users' private phone numbers through the chat system.

---

# 14. Core Database Entities

At minimum:

```text
users
profiles
user_roles
user_languages
user_interests

local_services
local_availability

tour_requests
bookings

conversations
conversation_members
messages

reviews
review_images

profile_images
service_images

verifications
audit_logs
```

Potential later entities:

```text
safety_incidents
disputes
dispute_evidence
notifications
match_candidates
```

---

# 15. Deployment

Recommended MVP deployment:

```text
                    Internet
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
       Cloudflare Pages    Android App
              │                 │
              └────────┬────────┘
                       │
                       ▼
                  Railway
                       │
            ┌──────────┼──────────┐
            │          │          │
            ▼          ▼          ▼
         Django    PostgreSQL   Redis
            │
            ▼
       Cloudflare R2
```

Recommended initial infrastructure:

* Cloudflare Pages for web
* Railway for Django
* PostgreSQL
* Redis
* Cloudflare R2 for images
* Expo for Android builds

Do not use Kubernetes for MVP.

Do not create multiple backend servers until traffic requires it.

---

# 16. Domain and HTTPS

Use a custom domain.

Cloudflare should manage DNS.

HTTPS must be enabled everywhere.

Required:

```text
Web → HTTPS
API → HTTPS
WebSocket → WSS
```

Never send authentication credentials or private user data over plain HTTP.

---

# 17. Google Play Deployment

Create a Google Play Console developer account.

Current Google Play registration fee:

```text
US$25
```

This is a one-time registration fee.

The MVP target is:

```text
Web
+
Android
```

Do not pay for Apple Developer membership yet unless iOS publication is required.

---

# 18. iOS

The React Native/Expo codebase should remain compatible with iOS.

However, iOS publication is outside the initial MVP deployment target.

When iOS publication becomes necessary, add:

```text
Apple Developer Program
≈ US$99/year
```

---

# 19. Estimated MVP Cost

Assumptions:

* Self-developed software
* Initial user base: approximately 100–500 users
* No video uploads
* No VoIP
* No SMS/OTP
* No paid maps API
* No payment gateway initially
* Profile/service/review images
* Google authentication
* Android publication
* Web deployment

### Initial cost

| Item                  |               Estimated cost |
| --------------------- | ---------------------------: |
| React frontend        |                           $0 |
| Cloudflare Pages      |                           $0 |
| Django                |             $0 software cost |
| PostgreSQL            | Included/budgeted in hosting |
| Redis                 | Included/budgeted in hosting |
| Google authentication |                ~$0 initially |
| React Native          |                           $0 |
| Expo                  |                 $0 initially |
| Cloudflare R2         |                ~$0 initially |
| Image transformations |                ~$0 initially |
| Domain                |                 ~$10–20/year |
| Google Play Console   |             **$25 one-time** |
| GitHub                |                           $0 |
| **Initial cash cost** |                  **~$35–45** |

---

# 20. Monthly Operating Cost

Expected MVP infrastructure:

| Service                | Estimated monthly |
| ---------------------- | ----------------: |
| Django/backend hosting |             $5–10 |
| PostgreSQL             | included/budgeted |
| Redis                  | included/budgeted |
| R2 image storage       |    $0–2 initially |
| Cloudflare web hosting |                $0 |
| Authentication         |     ~$0 initially |
| CDN/HTTPS              |                $0 |
| **Estimated total**    |  **~$5–15/month** |

Use actual provider usage to determine the final bill.

The target is to keep the MVP infrastructure below approximately:

```text
US$15/month
```

while usage remains small.

---

# 21. First-Year Budget

Target budget:

```text
Initial setup:
≈ $35–45

Infrastructure:
≈ $5–15/month

Domain:
≈ $10–20/year
```

Estimated first-year infrastructure cost:

```text
≈ $105–225
```

At approximately 26,000 VND/USD:

```text
≈ 2.7–5.9 million VND/year
```

Recommended contingency:

```text
Budget approximately 5 million VND
for the first year.
```

This excludes:

* Developer salary/time
* Marketing
* Legal expenses
* Insurance
* Payment processing fees
* SMS/OTP
* Map API costs
* Identity verification services
* VoIP/phone-number masking
* Paid AI APIs
* Apple Developer membership

---

# 22. Cost Optimization Rules

The MVP should follow these rules:

### Rule 1 — No unnecessary paid SaaS

Prefer free tiers where practical.

### Rule 2 — Images go to R2

Never store image binaries in PostgreSQL.

### Rule 3 — Compress images

Do not allow unrestricted 20–50 MB uploads.

### Rule 4 — One backend

Use a modular Django monolith.

### Rule 5 — One PostgreSQL database

Do not create separate databases per feature.

### Rule 6 — Android first

Develop iOS-compatible code but delay App Store publishing.

### Rule 7 — No Kubernetes

Scale only when actual usage requires it.

### Rule 8 — No microservices

Split services only after there is a real operational reason.

---

# 23. MVP Definition of Done

The MVP deployment is considered complete when:

* [ ] Web application is publicly accessible
* [ ] HTTPS works
* [ ] User can register/login with Google
* [ ] User can create/edit profile
* [ ] User can upload avatar
* [ ] User can upload profile images
* [ ] Local can create a service
* [ ] Local can upload service images
* [ ] Traveler can browse locals
* [ ] Traveler can submit a tour request
* [ ] Local can respond to request
* [ ] Booking can be created
* [ ] Users can chat
* [ ] Users cannot publicly see each other's private phone/email
* [ ] Completed booking can generate a review
* [ ] Review can contain images
* [ ] Images are stored in Cloudflare R2
* [ ] PostgreSQL stores image metadata, not image binaries
* [ ] Android app connects to production API
* [ ] Android APK/AAB can be generated
* [ ] Android app is published to Google Play
* [ ] Basic logging and error monitoring are available
* [ ] Database backups are configured
* [ ] Environment secrets are not committed to Git
* [ ] Production CORS/CSRF/security settings are configured
* [ ] API authentication is protected
* [ ] Upload authorization prevents users from modifying another user's images

---

# 24. Future Scaling Target: ~5,000 Users

Do not over-engineer for 5,000 users on day one.

When usage increases, the architecture can evolve to:

```text
                 Cloudflare
                     │
              Load balancing/CDN
                     │
             ┌───────┴───────┐
             ▼               ▼
          Django 1        Django 2
             │               │
             └───────┬───────┘
                     │
              PostgreSQL
                     │
             ┌───────┴───────┐
             ▼               ▼
           Redis           Celery
                             │
                             ▼
                        Background jobs

                     │
                     ▼
               Cloudflare R2
```

The initial application should therefore be written so that Django can later run as multiple instances without requiring major architectural changes.

---

# 25. Important Development Principle

The goal of the MVP is **not** to build the final Tour-op infrastructure.

The goal is:

> Build the smallest production-ready system that allows real travelers and locals to discover each other, communicate, create bookings, complete experiences, and establish two-way reputation safely.

Prioritize:

```text
Trust
↓
Profiles
↓
Matching
↓
Communication
↓
Booking
↓
Review
```

Keep infrastructure simple until real users demonstrate where scaling is actually necessary.
