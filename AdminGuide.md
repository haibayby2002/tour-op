# Tour-op Admin Guide

How to get into the production admin, give staff access, and manage data in
the database (cities, users, reports, content) through it.

| What | Where |
|---|---|
| Admin site | **https://api.tour-op.com/admin/** |
| Login | Email + password (Google sign-in does **not** work for the admin) |
| Database | PostgreSQL on Railway (project `tour-op`). The admin reads and writes it directly |

> Every change you save in the admin goes to the **live production database** immediately.
> There is no "undo" except restoring a backup. Read before you click **Save** or **Go**.

---

## 1. First-time setup: create the owner (superuser) account

Done once, by the project owner, from the Windows PC that has the Railway CLI logged in.

### 1.1 SSH key (once per PC)

`railway ssh` needs an SSH key. Check `C:\Users\<you>\.ssh\id_ed25519` exists; if not, open **PowerShell**:

```powershell
New-Item -ItemType Directory -Force "$HOME\.ssh"
ssh-keygen -t ed25519 -N '""' -f "$HOME\.ssh\id_ed25519"
```

(The first line matters: on Windows `ssh-keygen` fails with `No such file or directory` if the `.ssh` folder doesn't exist yet.)

If Railway asks to register the key with your account the first time you use `railway ssh`, answer yes.

### 1.2 Create the superuser

In a normal **PowerShell window** (not the `!` prompt inside Claude Code: it can't answer
interactive questions and it mangles `\` in Windows paths):

```powershell
cd D:\tour-ops\backend
railway ssh --service api -- python manage.py createsuperuser
```

It asks for **email**, **full name** and **password** (twice). Use a long, unique password.
This account can read every user's private data.

**The email already has an account** (you signed up on the site with Google first)? Promote
that account instead and give it a password:

```powershell
railway ssh --service api -- python manage.py changepassword you@gmail.com
railway ssh --service api -- python manage.py shell -c "from apps.accounts.models import User; User.objects.filter(email='you@gmail.com').update(is_staff=True, is_superuser=True)"
```

### 1.3 Load the reference data (once, on a new database)

Fills cities, languages, interests and service categories. It creates **no** demo users and is safe to re-run.

```powershell
railway ssh --service api -- python manage.py seed_demo --reference-only
```

Never run plain `seed_demo` (without `--reference-only`) on production: it creates demo accounts
with a publicly known password.

---

## 2. Adding staff (other admins)

Staff never need SSH. You add them from the admin.

1. Ask the person to **sign up on tour-op.com** (Google or email).
2. Admin → **Accounts › Users** → search their email → open them.
3. Under **Status**:
   - tick **Staff status** (`is_staff`): allows them to log in to the admin
   - leave **Superuser status** unticked: only the owner should have it
   - under **User permissions**, add only what their job needs (see table below)
4. **Save**.
5. If they signed up with Google, they have no password. Send them to
   **https://api.tour-op.com/admin/password_change/** after you set a temporary one:
   on their user page click the **"this form"** link under *Password*, set a temporary password,
   and tell them to change it immediately.

### Suggested permission sets

Django permissions are named `Can add / change / delete / view <model>`.

| Role | Give these permissions |
|---|---|
| **Content editor** (keeps lists up to date) | add/change/view **city**, **language**, **interest**, **service category** |
| **Trust & Safety** (handles reports) | view/change **report**, **user**, **review**, **profile photo**, **local service**, **local profile**, **verification**, **external review source**, **booking**; view **message**, **conversation**, **audit log** |
| **Owner** | Superuser (everything) |

Tip: create these once as **Groups** (Admin → **Authentication and Authorization › Groups** → *Add group*,
pick the permissions) and then just add each staff user to a group, instead of ticking permissions per person.

### Removing a staff member

Open the user → untick **Staff status** → **Save**. They keep their normal Tour-op account but can
no longer open the admin. If they must lose all access, also suspend or ban them (section 4).

---

## 3. Managing reference data (cities, languages, interests, categories)

These lists feed the dropdowns on the website and the app.

### Add a city

Admin → **Profiles › Cities** → **Add city**.

| Field | Example | Notes |
|---|---|---|
| Name | `Phu Quoc` | English name |
| Name vi | `Phú Quốc` | Vietnamese name |
| Slug | `phu-quoc` | Filled in from the name. **Never change it later**: links and bookings refer to it |
| Country | `VN` | |
| Latitude / Longitude | `10.2899` / `103.9840` | Right-click the place in Google Maps to copy them |
| Is active | ✓ | |

### Remove a city

**Do not delete** a city that has users, services or bookings. Untick **Is active** instead.
It disappears from the dropdowns for new requests, and existing data keeps working.

Languages (**Profiles › Languages**, code like `ja`), interests (**Profiles › Interests**) and
service categories (**Experiences › Service categories**) work the same way.

---

## 4. Handling reports and users

### 4.1 Work a report

Admin → **Safety › Reports**. Filter on the right by **Status = OPEN** and sort by **Severity**.

1. Tick the report → **Action: Assign to me (in review)** → **Go**. Its status becomes `IN_REVIEW`
   and other staff can see you have it.
2. Open it. You'll see reporter, reported user, the related booking/message/review and the evidence files.
   Opening reports and conversations is **recorded in the audit log**.
3. Investigate. Conversations are under **Messaging › Conversations** (read-only).
4. Take action on the user or content (4.2 and section 5).
5. Write what you did and why in **Resolution note**, then select the report again →
   **Mark resolved** or **Dismiss** (not a valid report).

Reports **cannot be deleted**, even by staff. That's intentional, so evidence is never lost.

### 4.2 User statuses

Admin → **Accounts › Users** → search by email, name or phone.

| Status | Effect | How to set it |
|---|---|---|
| `ACTIVE` | Normal | Action **Reactivate selected users** |
| `SUSPENDED` | Can still log in and read, but **cannot send or receive tour requests or bookings**. Use while investigating or for a first offence | Action **Suspend selected users** |
| `BANNED` | **Cannot log in** and the session can't be refreshed. For serious or repeated violations | Open the user → **Status = BANNED** → Save |
| `DELETED` | Account closed | Don't set it by hand. Use only if a user asks for deletion |

Use the **actions** (tick the user → choose action → **Go**) where they exist: they write an
**audit log** entry recording who suspended whom. Editing the Status field directly does not.
When you ban someone by hand, write the reason in the related report's resolution note.

### 4.3 Verify a local's identity

After checking their document (e.g. CCCD) yourself:

- **Accounts › Verifications** → filter **Kind = IDENTITY** → tick → **Mark IDENTITY verifications as verified**
- **Profiles › Local profiles** → tick → **Mark as manually checked** (or **Reject manual check**)

Email/phone verification happens automatically and is never shown as "identity verified".

### 4.4 Disputed bookings

**Bookings › Bookings** → filter **Status** = `DISPUTED` → tick → **Resolve dispute → COMPLETED**
or **Resolve dispute → CANCELLED**.

---

## 5. Removing content (abuse, scams, illegal content)

Prefer **hiding** to **deleting**: hidden content disappears from the site but stays in the
database as evidence (important if the police or authorities ask for it).

| Content | How to remove | Kept as evidence? |
|---|---|---|
| Review | **Reviews › Reviews** → tick → **Hide selected reviews** (undo: *Unhide*) | ✅ |
| Profile photo | **Profiles › Profile photos** → tick → **Hide selected photos (moderation)** | ✅ |
| Local service | **Experiences › Local services** → open → **Status = ARCHIVED** → Save | ✅ (no audit entry) |
| External review link | **Profiles › External review sources** → **Reject** | ✅ |
| Profile text (bio, display name) | **Profiles › Profiles** → open → edit the text → Save. Copy the original text into the report's resolution note first | ⚠️ only in your note |
| Trip wish | **Wishes › Trip wishes** → open → change **Status** to `CLOSED` → Save | ✅ (no audit entry) |
| Chat message | **Cannot be removed in the admin.** Messages with phone numbers/emails are already blocked automatically. For anything else, suspend/ban the sender | n/a |

**Legal requests** (police, Ministry of Information and Communications, court):
record who asked, the date, the legal basis and what you removed in the **resolution note** of a
report (create one if there isn't any). Don't delete the content: hide it.

Not built yet (planned): one **Take down / Restore** action with a required reason for every content
type including chat messages, a **Ban** action with audit log, separate staff roles created
automatically, and audit entries for city/reference-data edits.

---

## 6. Audit log

**Audit › Audit logs** is read-only. It shows who suspended/reactivated users, verified identities,
hid photos/reviews, and which staff opened reports or conversations, with time and IP.
Check it regularly when you have several staff.

---

## 7. Working with the database directly (owner only, last resort)

Prefer the admin for everything. Direct access is for fixes the admin can't do.

```powershell
cd D:\tour-ops\backend
# Django shell inside production (Python, uses the real models and their rules)
railway ssh --service api -- python manage.py shell
# Raw SQL console on the production Postgres
railway connect Postgres
```

Rules:

1. **Back up first**: Railway dashboard → *Postgres* → *Backups* → *Create backup*.
2. Never delete users, bookings, reports or messages with SQL. Use statuses.
3. Never paste production data into chats, tickets or AI tools. It contains private phone numbers and emails.

---

## 8. Security checklist for staff

- Use a unique, long password for the admin. Never share accounts: each person has their own login,
  so the audit log stays meaningful.
- Only the owner has **Superuser status**.
- Remove **Staff status** the same day someone leaves the team.
- Never send users' phone numbers or emails to anyone outside Tour-op. Users talk through the app.
- Don't log in to the admin from shared or public computers.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| "Please enter the correct email and password for a staff account" | The user isn't **Staff** yet, or has no password (signed up with Google). See section 2 step 5 |
| Logged in but a section is missing | That staff user lacks the permission. Owner adds it under **User permissions** or their group |
| `No SSH keys found` from `railway ssh` | Create a key (section 1.1) |
| `cd: D:tour-opsbackend: No such file` | You ran it with `!` inside Claude Code (bash). Use a PowerShell window, or `cd /d/tour-ops/backend` |
| `createsuperuser` hangs or errors in Claude Code | It needs to ask questions. Run it in a PowerShell window |
| Dropdowns on the site are empty | Reference data not loaded. Run section 1.3 |
