# Seeding and Safety Testing

Two questions answered here:

1. How to load **real data** (a list of cities, a list of recommended places) in one go instead of typing it into the admin one row at a time.
2. How to **test the safety features** (reports, block, contact filter, privacy, disputes).

---

## Part 1: Real seeding

### 1.1 How it works today

| Data | Where it comes from now | Bulk import? |
|---|---|---|
| Cities | `backend/seed/cities.csv` (4 cities), and a hard-coded list of 7 demo cities in `backend/apps/common/management/commands/seed_demo.py` (`CITIES`) | **Yes:** `import_reference` (§1.2) |
| Languages | `backend/seed/languages.csv` (10 languages), and the same list in `seed_demo.py` (`LANGUAGES`) | **Yes:** `import_reference` (§1.2) |
| Interests | `backend/seed/interests.csv` (18 interests), and the same list in `seed_demo.py` (`INTERESTS`) | **Yes:** `import_reference` (§1.2) |
| Service categories | `seed_demo.py` only (`CATEGORIES`) | Only by editing Python code |
| Recommended places | `backend/seed/places.csv` (26 places in the 4 cities). Model: `Place` (§1.3) | **Yes:** `import_reference` (§1.2) |

Cities, languages, interests and places all live in CSV files and are loaded with `import_reference`.

### 1.2 Data files + the `import_reference` command

The real data is kept as **CSV files in the repo**, edited in Excel or Google Sheets, and loaded with one command that is **safe to re-run**.

```
backend/seed/
  cities.csv       # the 3 biggest cities in Vietnam, plus Da Nang
  languages.csv    # the 10 languages travelers and locals can pick
  interests.csv    # the 18 interests, same as the local demo seed
  places.csv       # 26 recommended places, suggested when locals build an itinerary
```

**Example: `cities.csv`** (the file as it is in the repo: Vietnam's three largest cities by population, plus Da Nang)

```csv
slug,name,name_vi,country,latitude,longitude,is_active
ho-chi-minh-city,Ho Chi Minh City,TP. Hồ Chí Minh,VN,10.776900,106.700900,1
hanoi,Hanoi,Hà Nội,VN,21.028500,105.854200,1
danang,Da Nang,Đà Nẵng,VN,16.054400,108.202200,1
hai-phong,Hai Phong,Hải Phòng,VN,20.844900,106.688100,1
```

**Example: `languages.csv`** (`code` is the ISO 639-1 code)

```csv
code,name,name_vi
vi,Vietnamese,Tiếng Việt
en,English,Tiếng Anh
fr,French,Tiếng Pháp
de,German,Tiếng Đức
ja,Japanese,Tiếng Nhật
ko,Korean,Tiếng Hàn
zh,Chinese,Tiếng Trung
es,Spanish,Tiếng Tây Ban Nha
ru,Russian,Tiếng Nga
th,Thai,Tiếng Thái
```

**Example: `interests.csv`** (`category` groups interests on the profile screen: `food`, `culture`, `nightlife`, `activity`, `outdoors`, `local-life`)

```csv
slug,name,name_vi,category
street-food,Street food,Ẩm thực đường phố,food
coffee,Coffee culture,Văn hoá cà phê,food
cooking,Cooking,Nấu ăn,food
history,History,Lịch sử,culture
architecture,Architecture,Kiến trúc,culture
art,Art & galleries,Nghệ thuật,culture
crafts,Traditional crafts,Làng nghề truyền thống,culture
spiritual,Temples & pagodas,Đền chùa,culture
music,Live music,Nhạc sống,nightlife
nightlife,Nightlife,Cuộc sống về đêm,nightlife
photography,Photography,Nhiếp ảnh,activity
nature,Nature,Thiên nhiên,outdoors
hiking,Hiking,Leo núi,outdoors
beaches,Beaches,Biển,outdoors
cycling,Cycling,Đạp xe,outdoors
motorbike,Motorbike trips,Đi xe máy,outdoors
markets,Local markets,Chợ địa phương,local-life
local-life,Everyday local life,Đời sống người dân,local-life
```

Keep the slugs the same as in `seed_demo.py`, so a database seeded locally and one imported from these files have the same records.

**Example: `places.csv`** (`city` is a city slug from `cities.csv` and `category` an interest slug from `interests.csv`; `category`, coordinates, `address` and `description` may be empty). The first rows of the file:

```csv
slug,city,name,name_vi,category,latitude,longitude,address,description,is_active
ben-thanh-market,ho-chi-minh-city,Ben Thanh Market,Chợ Bến Thành,markets,10.772500,106.698000,"Lê Lợi, Bến Thành, Quận 1",Historic central market with food stalls and souvenirs,1
binh-tay-market,ho-chi-minh-city,Binh Tay Market,Chợ Bình Tây,markets,10.749800,106.651100,"57A Tháp Mười, Quận 6",The big wholesale market of Chinatown (Cho Lon),1
hoan-kiem-lake,hanoi,Hoan Kiem Lake,Hồ Hoàn Kiếm,history,21.028800,105.852200,"Hoàn Kiếm, Hà Nội",Heart of the Old Quarter,1
dragon-bridge,danang,Dragon Bridge,Cầu Rồng,architecture,16.061100,108.227400,"Cầu Rồng, Hải Châu",Dragon-shaped bridge that breathes fire on weekend nights,1
hai-phong-opera-house,hai-phong,Hai Phong Opera House,Nhà hát Lớn Hải Phòng,architecture,20.857200,106.684200,"Quang Trung, Hồng Bàng",French colonial theatre in the city centre,1
```

The file has 26 places: 8 in Ho Chi Minh City, 7 in Hanoi, 6 in Da Nang and 5 in Hai Phong. Take coordinates from Google Maps (right-click the place → copy the numbers).

To add a city, language, interest or place, add a row and run the command again. To add Hue, for example:

```csv
hue,Hue,Huế,VN,16.463700,107.590900,1
```

**Command:**

```powershell
cd D:\tour-ops\backend
# check first: shows what would be created/updated, writes nothing
.venv\Scripts\python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv --dry-run
# for real
.venv\Scripts\python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv
```

Example output on an empty database:

```
seed/cities.csv: 4 created, 0 updated, 0 unchanged
seed/languages.csv: 10 created, 0 updated, 0 unchanged
seed/interests.csv: 18 created, 0 updated, 0 unchanged
seed/places.csv: 26 created, 0 updated, 0 unchanged
Reference data imported.
```

How the command behaves:

- **Knows the file by its header.** `slug,name,name_vi,country,latitude,longitude,is_active` is a cities file, `code,name,name_vi` is a languages file and `slug,name,name_vi,category` is an interests file and `slug,city,name,name_vi,category,latitude,longitude,address,description,is_active` is a places file. Any other header is rejected.
- **Order matters for places.** Files are imported in the order given, and a place's `city` and `category` must already exist (in the database or in an earlier file on the same command line). Put `places.csv` last.
- **Upserts by `slug` (cities, interests, places) or `code` (languages).** A new key creates a record and an existing key updates it. Running it twice changes nothing, so it is safe on production.
- **Never deletes.** To retire a city or place, set `is_active` to `0` in the file. Deleting would break users, services and bookings that point to it (see AdminGuide §3). A city that is in the database but not in the file is left alone.
- **All or nothing.** It runs in one transaction. If any row is invalid (missing name, unknown city or category, bad or out-of-range coordinates, `is_active` not 1/0, a duplicate key in the file) it prints the file and line number and writes nothing.
- **Reads UTF-8** (with or without BOM), so Vietnamese names (`Hải Phòng`) come through correctly. In Excel use *Save As → CSV UTF-8*.
- `seed_demo --reference-only` is separate: it still loads its own hard-coded lists (7 demo cities, languages, interests and service categories). Use it locally for demo data, and `import_reference` for production.

**Getting it to production.** `railway ssh` runs inside the deployed container, so the CSV files have to be deployed with the code first:

```powershell
cd D:\tour-ops\backend
railway up --service api --detach
# wait until the deployment is Active in the Railway dashboard, then:
railway ssh --service api -- python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv --dry-run
railway ssh --service api -- python manage.py import_reference seed/cities.csv seed/languages.csv seed/interests.csv seed/places.csv
```

Check the result at https://api.tour-op.com/api/v1/meta/: `cities`, `languages` and `interests` should no longer be empty, and https://api.tour-op.com/api/v1/places/?city=hanoi should list the Hanoi places.

Back up the database first (Railway → Postgres → Backups), as in AdminGuide §7.

### 1.3 The `Place` model (recommended places)

`backend/apps/profiles/models.py`, admin page **Profiles › Places**.

| Field | Type | Notes |
|---|---|---|
| `slug` | unique slug | Stable ID used by the import. Never change it |
| `city` | FK → City | Required. A city with places can't be deleted (retire it with `is_active`) |
| `name`, `name_vi` | text | Both are offered as suggestions and both are matched |
| `category` | FK → Interest, optional | e.g. `markets`, `history`, `beaches` |
| `latitude`, `longitude` | decimal, optional | Used for the **Map** link on the itinerary |
| `address`, `description` | text, optional | |
| `is_active` | bool | Hide instead of delete |

**How it is used: suggestions, never required.**

- When a local builds an itinerary (web: booking → *Propose itinerary*), the **Place** box of each stop suggests the active places in the booking's city as they type. They can pick one or type any other place. Both are accepted.
- When the proposal is saved, a stop whose `place_name` matches a place's English or Vietnamese name in that city (ignoring upper/lower case) is linked to it (`ItineraryStop.place`). Otherwise `place` stays empty and the stop is free text, as before.
- A linked stop shows a **Map** link (Google Maps) in the agreement for both people.
- Retiring or deleting a place never changes existing agreements. The stop keeps its `place_name`, and a deleted place just removes the link.
- API: `GET /api/v1/places/?city=<city slug>&q=<text>` (public, active places only).
- Not done yet: the mobile app's propose screen has no suggestions (free text works as before, and linked stops come back from the API there too), and `LocalService` has no place link.

### 1.4 Alternative: import from the admin (no SSH)

The `django-import-export` package adds **Import / Export** buttons to admin list pages. Staff can upload the CSV themselves, preview the changes and confirm.

- Pro: staff don't need the Railway CLI.
- Con: anyone with *add city* permission can bulk-change live data, and those imports leave no Tour-op audit log entry unless that is added too.

**Recommendation:** build the command first (1.2), because it's simple, reviewable in git and safe to re-run. Add admin import only when non-technical staff start maintaining the place list.

---

## Part 2: Testing safety

Test it at three levels, from cheapest to most realistic.

### 2.1 Automated tests (run before every deploy)

```powershell
cd D:\tour-ops\backend
.venv\Scripts\python -m pytest
```

On 2026-10-08, the 68 tests in the safety-related files below all passed, in about 1 minute. They use a throwaway test database and never touch production.

| What is protected | Test file → tests |
|---|---|
| Reports are private, can't be deleted, safety reports become CRITICAL, can open a dispute | `test_safety.py`: `test_report_is_private_and_not_deletable`, `test_safety_report_is_critical_and_can_open_dispute` |
| Can't report on someone else's booking | `test_safety.py`: `test_outsider_cannot_report_on_foreign_booking` |
| Evidence upload | `test_safety.py`: `test_evidence_upload` |
| Trip share link hides contact details and price | `test_safety.py`: `test_trip_share_link_has_no_contact_or_price` |
| Phone numbers and emails blocked in chat; Zalo/WhatsApp/links trigger a warning | `test_contact_filter.py` (all), `test_booking_flow.py`: `test_message_with_phone_is_blocked_and_hidden_from_recipient` |
| No contact details in names, bios or wish offers | `test_accounts.py`: `test_contact_details_not_allowed_in_name`, `test_profiles.py`: `test_bio_with_phone_is_rejected`, `test_wishes.py`: `test_offer_message_cannot_contain_contacts` |
| Public profiles and search never show phone or email | `test_profiles.py`: `test_public_profile_never_exposes_contact_details`, `test_search_results_do_not_expose_contacts` |
| Blocked users can't request or message | `test_booking_flow.py`: `test_blocked_users_cannot_request_or_message` |
| Outsiders can't read messages, bookings, wishes or the live chat | `test_booking_flow.py`: `test_outsider_cannot_read_messages_or_booking`, `test_wishes.py`: `test_wish_is_private_to_owner_and_matched_locals`, `test_realtime.py` (both) |
| Agreements can't be changed silently; sightseeing stops can't be dropped | `test_booking_flow.py`: `test_accepted_agreement_is_immutable_and_changes_need_new_consent`, `test_sightseeing_stop_cannot_be_declined` |
| Reviews only after a real, completed booking; no self-review | `test_booking_flow.py`: `test_reviews_require_completed_booking_and_no_self_review` |
| Unverified users can't book; under-age signup rejected; banned accounts can't sign in with Google | `test_booking_flow.py`: `test_unverified_traveler_cannot_send_request`, `test_profiles.py`: `test_unverified_locals_cannot_receive_requests`, `test_accounts.py`: `test_underage_registration_rejected`, `test_google_login.py`: `test_bad_signature_and_banned_accounts` |
| Reference import is all-or-nothing, re-runnable, and `--dry-run` writes nothing | `test_import_reference.py` (all) |
| Place suggestions are per city and only active ones; a stop links to a place only by exact name in the booking's city, and free text still works | `test_places.py` (all) |
| Uploaded photos are re-encoded with metadata (GPS location) stripped; non-images rejected | `test_images.py` |

**Rule:** every safety bug you find becomes a new test in one of these files *before* it is fixed, so it can't come back.

### 2.2 Manual testing on your PC (two browsers, demo data)

Run the app locally (see `README.md`), then load demo users. **Local database only, never production:**

```powershell
cd D:\tour-ops\backend
.venv\Scripts\python manage.py seed_demo
```

All demo users share the password `TourOps!2026`. Open **two browsers** (or one normal + one private window): traveler `traveler@tour-op.local` in one, local `linh@tour-op.local` in the other. Use a third window for the staff console at `/staff` (or raw data in `/admin`) as `admin@tour-op.local`. The demo set has 6 travelers (`traveler`, `sophie`, `kenji`, `minji`, `lukas`, `maria`) and 10 locals (`linh`, `minh`, `huong`, `tuan`, `mai`, `an`, `khoa`, `trang`, `phuc`, `ngoc`), all `@tour-op.local`.

Write ✅/❌ next to each line and keep the result with the release.

**Contact details and off-platform pressure**

- [ ] Traveler sends `call me 0901 234 567` in chat → the sender sees it marked as blocked, and **Linh never sees it**
- [ ] Try evasions: `0 9 0 1 2 3 4 5 6 7`, `+84-901-234-567`, `abc at gmail dot com`, `zalo me` → blocked or warned. Write down any that get through
- [ ] Put a phone number in the bio, display name and a wish offer → rejected

**Block**

- [ ] Linh blocks the traveler → the traveler can't send a new request or message. Unblock → it works again

**Report and dispute**

- [ ] Traveler reports Linh with category **Safety** → in admin it shows as **CRITICAL** / **OPEN**
- [ ] Log in as Linh → nowhere in the site or the app does it show that Linh was reported
- [ ] Report with *open dispute* on a confirmed booking → booking becomes `DISPUTED`; resolve it in admin (AdminGuide §4.4)
- [ ] Attach an evidence photo → visible to staff in admin
- [ ] Try to delete the report in admin → not possible

**Privacy**

- [ ] Log out and open a local's public profile and the search page → no phone or email anywhere, including in the browser's Network tab (F12 → Network → the API response)
- [ ] Copy a booking URL from the traveler and open it as a third user (e.g. `minh@tour-op.local`) → "not found"
- [ ] Create a trip share link and open it logged out → itinerary shown, but no phone, email or price
- [ ] Upload a phone photo with location on, download it from the site, check its properties → no GPS data

**Account enforcement** (do these in admin, with the actions from AdminGuide §4.2)

- [ ] Suspend the traveler → can still log in and read, but can't send a request
- [ ] Ban the traveler → logged out at the next refresh, can't log in (email or Google)
- [ ] Check **Audit › Audit logs** → the suspend, report opening and message block are recorded

**Agreement honesty**

- [ ] Linh proposes an agreement, the traveler accepts, then Linh tries to change the price → needs a new version that the traveler has to accept again
- [ ] Shopping/partner stops can be declined by the traveler; sightseeing stops can't

Repeat the chat, report and privacy checks in the **mobile app**. It uses the same API, but its screens can leak data the web doesn't (e.g. a notification preview showing a blocked message).

### 2.3 Production

- Demo users on production are **opt-in**: set `SEED_DEMO=1` and `DEMO_PASSWORD=<a private password>` on the Railway `api` service and the entrypoint runs `seed_demo` (idempotent) on every deploy. With `DJANGO_DEBUG` off it refuses to run without `DEMO_PASSWORD`, creates no staff account, never overwrites cities/languages/interests from the CSVs, and files no sample reports. It creates 6 demo travelers and 10 demo locals (`*@tour-op.local`) in the 4 CSV cities. Remove `SEED_DEMO` when you no longer want them refreshed.
- Don't file fake reports against real users.
- After each deploy, do a 5-minute smoke test with **two accounts of your own** (e.g. two of your emails): send a message containing a phone number and confirm it's blocked, file one report against your second account, check it appears in admin, then **Dismiss** it with the note "deploy smoke test".
- For anything bigger, create a separate Railway **environment** (`staging`) with its own database, deploy there first and run the 2.2 checklist against it. It costs a little extra, but it means you never test on real users' data.

### 2.4 Known gaps (worth tests or features)

These are not covered today (also listed in AdminGuide §5):

- Chat messages can't be taken down by staff, only the sender banned.
- Banning by editing the Status field writes no audit log entry.
- Archiving a service or closing a trip wish writes no audit log entry.
- No automated test checks that a **suspended** user is refused a booking, or that a **banned** user's existing session dies on refresh. Both should be added to `test_safety.py`.
- No test runs a list of known filter evasions (spelled-out numbers, spaces, Vietnamese words for "call me"). Collect the ones from 2.2 that slipped through and add them to `test_contact_filter.py`.
- No test checks rate limits on reports and messages: the test settings turn throttling off (`tests/conftest.py`).
