Yes. For Tour-op, I recommend a **relational PostgreSQL model centered around `users → profiles → trips/requests → bookings → conversations → reviews/disputes`**.

The important design principle is: **don't put Traveler and Local into completely separate user tables**. They are both users, and a person may potentially act in either role.

## 1. Recommended ERD

```text
                                      ┌──────────────────┐
                                      │      users       │
                                      ├──────────────────┤
                                      │ PK id            │
                                      │ email            │
                                      │ phone            │
                                      │ full_name        │
                                      │ birth_year       │
                                      │ status           │
                                      │ created_at       │
                                      └────────┬─────────┘
                                               │ 1
                                  ┌────────────┼────────────┐
                                  │                         │
                                  │ 1                       │ 1
                           ┌──────▼───────┐          ┌──────▼───────┐
                           │   profiles   │          │ verifications│
                           └──────┬───────┘          └──────────────┘
                                  │
                     ┌────────────┼────────────┐
                     │                         │
                ┌────▼─────┐             ┌────▼──────┐
                │  photos  │             │languages  │
                └──────────┘             └───────────┘
                     │
              ┌──────┴───────────┐
              │                  │
       ┌──────▼──────┐    ┌──────▼────────┐
       │ local_info  │    │traveler_info  │
       └──────┬──────┘    └──────┬────────┘
              │                  │
       ┌──────▼──────┐           │
       │  services   │           │
       └──────┬──────┘           │
              │                  │
              └────────┬─────────┘
                       │
                 ┌─────▼─────┐
                 │ tour_     │
                 │ requests  │
                 └─────┬─────┘
                       │
                 ┌─────▼─────┐
                 │ bookings  │
                 └─────┬─────┘
                       │
          ┌────────────┼─────────────┐
          │            │             │
     ┌────▼─────┐ ┌────▼──────┐ ┌────▼──────┐
     │ messages │ │ incidents │ │  reviews  │
     └──────────┘ └────┬──────┘ └───────────┘
                       │
                  ┌────▼──────┐
                  │ disputes  │
                  └───────────┘
```

I'd make a few changes to this conceptual ERD for the actual relational implementation.

---

# 2. Core relational model

## `users`

The identity/account table.

```text
users
-----
id                  PK
email               UNIQUE
phone               UNIQUE
password_hash
full_name
birth_year
status
created_at
updated_at
```

I would **not** put things like `avatar`, `bio`, `languages`, `interests`, etc. here.

Those belong to the profile.

---

# 3. `profiles`

```text
profiles
--------
user_id             PK, FK → users.id
display_name
bio
avatar_url
location_name
profile_visibility
profile_completion
created_at
updated_at
```

This gives you:

```text
users
  │
  └── profiles
```

rather than:

```text
users
 ├── traveler_name
 ├── traveler_bio
 ├── local_bio
 ├── local_languages
 └── ...
```

---

# 4. User roles

I recommend a separate table rather than:

```text
users.role = 'TRAVELER'
```

because eventually:

```text
User A → Traveler
User A → Local
```

is perfectly reasonable.

```text
user_roles
----------
user_id             FK → users.id
role                ENUM('TRAVELER', 'LOCAL')
created_at

PK(user_id, role)
```

So:

```text
User #123
 ├── TRAVELER
 └── LOCAL
```

This is much more flexible.

---

# 5. Local-specific information

```text
local_profiles
--------------
user_id             PK, FK → users.id
experience_summary
years_experience
verification_status
availability_status
created_at
updated_at
```

You could later add:

```text
response_rate
completed_tours
cancellation_rate
```

but I recommend **calculating these from actual records**, rather than storing them as manually editable values.

---

# 6. Traveler-specific information

```text
traveler_profiles
-----------------
user_id             PK, FK → users.id
travel_style
bio
created_at
updated_at
```

Don't put everything into one giant profile table.

Keep user-specific attributes separated where appropriate.

---

# 7. Languages

Don't store:

```text
languages = "Vietnamese, English, Chinese"
```

Instead:

```text
languages
---------
id                  PK
code                UNIQUE
name
```

and:

```text
user_languages
--------------
user_id             FK → users.id
language_id         FK → languages.id
proficiency

PK(user_id, language_id)
```

Example:

```text
users
  ↓
user_languages
  ↓
English
Vietnamese
Chinese
```

This makes matching much easier.

---

# 8. Interests / skills

Same principle.

```text
interests
---------
id
name
category
```

```text
user_interests
--------------
user_id
interest_id

PK(user_id, interest_id)
```

This becomes extremely useful for matching.

For example:

```text
Traveler
 ├── Food
 ├── Photography
 └── History

Local
 ├── Food
 ├── Photography
 └── Architecture
```

Then your matching engine can calculate overlap.

---

# 9. Local services

A Local shouldn't simply be a profile.

They offer **specific experiences/services**.

```text
local_services
--------------
id                  PK
local_id            FK → users.id
title
description
location_name
duration_minutes
price
currency
status
created_at
updated_at
```

For example:

```text
Local #123

Services
├── Street food experience
├── Saigon photography walk
└── Local coffee tour
```

This is important because one Local can offer multiple experiences.

---

# 10. Service categories

I'd normalize this too:

```text
service_categories
------------------
id
name
description
```

Then:

```text
local_services
--------------
id
local_id
category_id
title
description
...
```

Example:

```text
Food
Photography
Culture
History
Nightlife
Shopping
...
```

Those categories are only examples, **not requirements from your Canvas**.

---

# 11. Availability

For MVP:

```text
local_availability
------------------
id
local_id
start_at
end_at
status
```

Later you can support recurring schedules.

For example:

```text
Local #123

2026-10-05 09:00 → 13:00
2026-10-07 14:00 → 18:00
```

Don't make availability part of `local_profiles`.

---

# 12. Traveler trip/request

This is one of the most important tables.

```text
tour_requests
-------------
id
traveler_id         FK → users.id
destination
start_at
end_at
group_size
budget_min
budget_max
description
status
created_at
updated_at
```

Example:

```text
Traveler
   ↓
"I'll be in HCMC Oct 10–12.
 I want local food + photography."
   ↓
tour_request
```

---

# 13. Matching

I would **not immediately store matching scores in the database**.

Initially:

```text
tour_request
      ↓
matching service
      ↓
candidate locals
```

If you eventually need persistent recommendations:

```text
match_candidates
----------------
id
tour_request_id
local_id
score
reason
status
created_at

UNIQUE(tour_request_id, local_id)
```

Example:

```text
Request #500

Local A → 0.92
Local B → 0.87
Local C → 0.81
```

But I'd treat `score` as a **derived recommendation result**, not a permanent truth about the person.

---

# 14. Booking

The central transaction.

```text
bookings
--------
id
tour_request_id     FK
traveler_id         FK
local_id            FK
service_id          FK
start_at
end_at
status
agreed_price
currency
created_at
updated_at
```

Why duplicate `traveler_id` and `local_id` when they can theoretically be derived?

Because a booking is a **historical snapshot/transaction**.

The relationship at the time of booking should remain explicit.

---

# 15. Booking status

I'd use a controlled state machine:

```text
REQUESTED
    ↓
ACCEPTED
    ↓
CONFIRMED
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

with:

```text
REJECTED
CANCELLED
DISPUTED
```

Don't allow arbitrary status transitions.

---

# 16. Conversations

Messaging should be associated with the actual relationship.

```text
conversations
-------------
id
booking_id         FK → bookings.id
created_at
closed_at
status
```

Then:

```text
conversation_members
--------------------
conversation_id
user_id

PK(conversation_id, user_id)
```

And:

```text
messages
--------
id
conversation_id
sender_id
message_type
content
created_at
deleted_at
```

This gives you:

```text
Booking #123
   │
   └── Conversation #456
          ├── Traveler
          └── Local
```

That's much safer than letting users have arbitrary unassociated conversations.

---

# 17. Reviews

Reviews should be attached to the **completed booking**.

```text
reviews
-------
id
booking_id          FK
reviewer_id         FK → users.id
reviewee_id         FK → users.id
rating
comment
created_at

UNIQUE(booking_id, reviewer_id)
```

This allows:

```text
Traveler → Local
Local → Traveler
```

after the same booking.

For example:

```text
Booking #100

Traveler reviews Local
Local reviews Traveler
```

---

# 18. Verification

Keep verification separate from the profile.

```text
verifications
-------------
id
user_id
type
status
verified_at
expires_at
created_at
```

Possible types might eventually include:

```text
EMAIL
PHONE
IDENTITY
```

But the exact verification methods are **not specified in your Canvas**, so these are proposed values.

If documents are required:

```text
verification_documents
----------------------
id
verification_id
document_type
storage_key
status
created_at
```

Be careful with this table because identity documents are sensitive.

---

# 19. Safety incidents

```text
safety_incidents
----------------
id
booking_id
reporter_id
type
description
status
severity
created_at
resolved_at
```

Example:

```text
Booking #100
     │
     └── Safety Incident #55
              │
              ├── Reporter
              ├── Description
              ├── Evidence
              └── Resolution
```

---

# 20. Disputes

A dispute is different from a safety incident.

```text
disputes
--------
id
booking_id
opened_by
reason
description
status
resolution
created_at
resolved_at
```

And:

```text
dispute_evidence
----------------
id
dispute_id
submitted_by
type
content_url
description
created_at
```

---

# 21. Audit log

For Tour-op, I'd consider this **essential**, not optional.

```text
audit_logs
----------
id
actor_user_id
entity_type
entity_id
action
metadata
created_at
```

Example:

```text
2026-10-02 10:30
User 123
BOOKING 456
ACCEPTED

2026-10-02 10:31
User 123
MESSAGE 789
CREATED

2026-10-05 09:02
User 456
BOOKING 456
IN_PROGRESS
```

This becomes extremely valuable when resolving disputes.

---

# 22. Photos

Don't put multiple photos into `profiles`.

```text
profile_photos
--------------
id
user_id
storage_key
caption
sort_order
status
created_at
```

Similarly, service photos can be:

```text
service_photos
--------------
id
service_id
storage_key
sort_order
```

---

# 23. Recommended complete ERD

Putting everything together:

```text
                         ┌─────────────┐
                         │    USERS    │
                         └──────┬──────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
     ┌────▼─────┐          ┌────▼─────┐        ┌────▼────────┐
     │ PROFILES │          │ USER_ROLES│        │VERIFICATIONS│
     └────┬─────┘          └───────────┘        └─────────────┘
          │
     ┌────┼──────────────┐
     │    │              │
┌────▼──┐ │        ┌─────▼────────┐
│PHOTOS │ │        │ USER_INTERESTS│
└───────┘ │        └──────────────┘
           │
     ┌─────▼─────────┐
     │ USER_LANGUAGES│
     └───────────────┘


        LOCAL SIDE
             │
      ┌──────▼─────────┐
      │ LOCAL_PROFILES │
      └──────┬─────────┘
             │
      ┌──────▼─────────┐
      │LOCAL_SERVICES  │
      └──────┬─────────┘
             │
      ┌──────▼─────────┐
      │SERVICE_PHOTOS  │
      └────────────────┘


       TRAVELER SIDE
             │
      ┌──────▼─────────┐
      │TRAVELER_PROFILE│
      └──────┬─────────┘
             │
      ┌──────▼─────────┐
      │ TOUR_REQUESTS  │
      └──────┬─────────┘
             │
      ┌──────▼─────────┐
      │ MATCH_CANDIDATES│
      └──────┬─────────┘
             │
             ▼
         ┌─────────┐
         │ BOOKINGS│
         └────┬────┘
              │
      ┌───────┼─────────────┐
      │       │             │
┌─────▼────┐  │       ┌─────▼───────┐
│MESSAGES  │  │       │  REVIEWS    │
└──────────┘  │       └─────────────┘
              │
        ┌─────▼──────────┐
        │SAFETY_INCIDENTS│
        └─────┬──────────┘
              │
        ┌─────▼──────┐
        │  DISPUTES  │
        └─────┬──────┘
              │
        ┌─────▼───────────┐
        │DISPUTE_EVIDENCE │
        └─────────────────┘

              ALL
               │
        ┌──────▼──────┐
        │ AUDIT_LOGS  │
        └─────────────┘
```

## 24. One change I'd strongly recommend

Don't make `tour` your primary entity.

Make **`booking`** the transactional center.

The lifecycle becomes:

```text
USER
 ↓
PROFILE
 ↓
TOUR REQUEST ←→ LOCAL SERVICE
 ↓
MATCH
 ↓
BOOKING
 ↓
CONVERSATION
 ↓
TOUR
 ↓
REVIEW
 ↓
REPUTATION
```

And separately:

```text
BOOKING
 ├── SAFETY INCIDENT
 └── DISPUTE
```

That model fits your Canvas particularly well because **Tour-op isn't merely selling a tour; it is creating a controlled relationship between two strangers**.

### MVP tables

If you're actually going to code this now, I would initially implement only these **14 tables**:

```text
1. users
2. profiles
3. user_roles
4. user_languages
5. user_interests
6. local_services
7. local_availability
8. tour_requests
9. bookings
10. conversations
11. messages
12. reviews
13. verifications
14. audit_logs
```

Then add:

```text
15. safety_incidents
16. disputes
17. dispute_evidence
18. match_candidates
```

when the corresponding workflow actually exists.

This keeps the first PostgreSQL schema reasonably lean while preserving the architecture needed for the **trust + safety** proposition.
