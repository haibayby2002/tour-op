# Tour-op account and identity specification

Decision baseline: one account can act as both a traveler and a local; phone number is optional at registration; identity checks are staged; and public profiles use a display name or nickname rather than exposing legal identity.

The key architectural principle is to separate account identity, authentication, user roles, public profile information, and verification evidence. This allows Tour-op to keep registration simple while introducing stronger checks only when a particular activity requires them.

## 1. Account and identity field inventory

The following is the proposed specification for the first unified web and Android implementation.

- Required means necessary for the account or workflow to function.
- Conditional means required only when a user activates a feature or a rule requires it.
- Optional means the user can leave it blank.
- System means generated or managed by Tour-op rather than directly entered.

### A. Core account fields

Scope: shared account model for all users, regardless of whether they travel, offer experiences, or do both.

| Field name           | Description                                                            | Rationale                                                                                                        | Scope                    |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `user_id`            | Immutable, unique internal account identifier                          | Stable references across profiles, messages, listings, and bookings without using email as a primary identifier. | Both; system             |
| `account_status`     | Account state: pending, active, suspended, deletion pending, or closed | Enables consistent access control and account lifecycle handling.                                                | Both; system             |
| `display_name`       | Public-facing name or nickname                                         | Supports recognition without requiring public legal identity.                                                    | Both; user-entered       |
| `email`              | Email address associated with the account                              | Supports login, recovery, and essential notifications.                                                           | Both; private            |
| `email_verified_at`  | Timestamp of successful email verification, or null if unverified      | Distinguishes an entered email from a verified one.                                                              | Both; system             |
| `phone_number`       | Optional phone number in normalized international format               | Supports recovery, contact, or phone-based features when needed.                                                 | Both; private            |
| `phone_verified_at`  | Timestamp of successful phone verification, or null if unverified      | Prevents the app from treating an unverified number as confirmed.                                                | Both; system             |
| `preferred_language` | User's preferred interface language                                    | Improves accessibility and communication.                                                                        | Both; private preference |
| `created_at`         | Account creation timestamp                                             | Supports account history, moderation, and reporting.                                                             | Both; system             |
| `updated_at`         | Last update timestamp for the account record                           | Helps with auditing and synchronization.                                                                         | Both; system             |
| `last_active_at`     | Last recorded meaningful activity, if needed                           | May support operational analytics; exact activity time should not be exposed publicly by default.                | Both; system/private     |
| `closed_at`          | Timestamp when account closure is completed                            | Supports lifecycle and retention workflows.                                                                      | Both; system             |

### B. Authentication and session fields

Authentication records should be separate from public profile data. A user should be able to change login methods without changing their Tour-op identity.

| Field name            | Description                                                        | Rationale                                                                                                 | Scope                             |
| --------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `auth_identity_id`    | Unique identifier for an authentication identity                   | Allows multiple sign-in methods to connect to one account safely.                                         | Authentication; system            |
| `auth_provider`       | Provider identifier, such as Google or email/password              | Supports the login methods offered by the app.                                                            | Authentication; private           |
| `provider_subject_id` | Stable user identifier supplied by the authentication provider     | Avoids relying on mutable provider display names or email addresses to identify an external account.      | Authentication; restricted        |
| `password_hash`       | Secure password hash, only if Tour-op manages passwords            | Needed only for native password authentication. Prefer a reputable authentication service if appropriate. | Authentication; highly restricted |
| `last_login_at`       | Last successful login timestamp                                    | Supports security monitoring and account management.                                                      | Authentication; private           |
| `session_revoked_at`  | Timestamp or event marker for session revocation, where applicable | Helps invalidate compromised or outdated sessions.                                                        | Authentication; system            |

Important: never store plaintext passwords, Google access tokens, refresh tokens, or session secrets in ordinary profile fields. If an authentication provider manages credentials, Tour-op should not duplicate them.

### C. User roles and capabilities

Since one account can be both a traveler and a local, avoid separate accounts for each role.

| Field name                | Description                                                                | Rationale                                                                 | Scope                         |
| ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| `traveler_enabled`        | Whether the account can use traveler features                              | Allows a user to request or book experiences.                             | Both; system/owner preference |
| `local_enabled`           | Whether the account has activated local features                           | Enables local onboarding without creating a second account.               | Both; system/owner preference |
| `local_onboarding_status` | Not started, in progress, submitted, approved, or rejected                 | Separates role activation from identity verification.                     | Local; system                 |
| `role_activated_at`       | Timestamp when a role was activated                                        | Supports audit and analytics.                                             | Both; system                  |
| `capability_status`       | Status of a particular restricted capability, such as publishing a listing | Enables feature-specific requirements without blocking ordinary browsing. | Capability; system            |

I recommend deriving role access from a shared account plus role/capability records, rather than treating traveler and local as mutually exclusive account types.

### D. Public profile fields

Keep public profile information separate from the account record. The public API should return only explicitly approved profile fields.

| Field name           | Description                               | Rationale                                                     | Scope                           |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| `profile_id`         | Stable profile identifier                 | Separates profile presentation from authentication identity.  | Profile; system                 |
| `avatar_url`         | Profile image or avatar reference         | Supports recognition while allowing non-photographic avatars. | Both; public                    |
| `bio`                | Optional short introduction               | Helps users assess compatibility.                             | Both; public                    |
| `city`               | Public city or service city               | Supports discovery without revealing a home address.          | Both; public                    |
| `languages`          | Languages the user can communicate in     | Helps travelers and locals assess compatibility.              | Both; public                    |
| `interests`          | Structured interests selected by the user | Enables interest-based recommendations.                       | Both; public or user-controlled |
| `profile_visibility` | Public, registered users only, or hidden  | Gives users control over discovery exposure.                  | Both; owner-controlled          |
| `profile_updated_at` | Last meaningful profile update            | Supports synchronization and stale-profile detection.         | Both; system                    |

Public profile rule: do not return `email`, `phone_number`, provider IDs, legal names, identity-document data, verification evidence, or internal moderation notes from the public profile endpoint—even if the UI does not display them.

### E. Verification records

A single Boolean such as `is_verified` is not enough. It can conceal important differences between email verification, phone ownership, and identity verification.

| Field name              | Description                                                      | Rationale                                                             | Scope                           |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| `verification_id`       | Unique verification attempt or record ID                         | Supports history, review, and troubleshooting.                        | Verification; system            |
| `verification_type`     | Email, phone, identity, or another explicitly defined check      | Distinguishes what was actually verified.                             | Verification; system            |
| `verification_status`   | Not started, pending, verified, failed, expired, or revoked      | Allows accurate status display and feature gating.                    | Verification; system            |
| `verification_provider` | Service or process that performed the check                      | Establishes the source of the result.                                 | Verification; restricted        |
| `verified_at`           | Time the check succeeded                                         | Supports evidence freshness and auditability.                         | Verification; restricted        |
| `expires_at`            | Expiry time, if the check has a defined expiry                   | Allows checks to be renewed when required.                            | Verification; system            |
| `failure_reason_code`   | Controlled reason for a failed check                             | Helps with support and recovery without exposing excessive details.   | Verification; restricted        |
| `evidence_reference`    | Reference to evidence held by an authorized verification service | Avoids copying identity documents into the main application database. | Verification; highly restricted |
| `reviewed_by`           | Authorized staff or service identifier, where applicable         | Supports accountability for manual checks.                            | Verification; restricted        |
| `reviewed_at`           | Time of manual decision                                          | Supports auditing and appeals.                                        | Verification; restricted        |

Do not store an identity-document image, full document number, or biometric template just because a verification provider offers them. First establish whether Tour-op needs to retain that information at all. Prefer a provider's verification result and reference when legally and technically appropriate.

## 2. Field-by-field implementation controls

The tables above define the field inventory. The following controls make those fields implementable across the web app, Android app, and backend.

| Field                       | Requirement                                            | Validation                                                                                      | Lifecycle                                                                           |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `user_id`                   | Required; system-generated                             | Unique, immutable identifier                                                                    | Created at account creation; retained as needed for referential integrity           |
| `account_status`            | Required; system-managed                               | Enumerated values and authorized transitions                                                    | Changes through account, moderation, and deletion workflows                         |
| `display_name`              | Required before profile publication                    | Trim whitespace; enforce length and safe rendering; prevent impersonation where appropriate     | Editable by owner; changes reflected in public profile                              |
| `email`                     | Required if email is the chosen login/recovery channel | Normalize; verify ownership; enforce uniqueness according to account policy                     | Editable through a re-verification flow                                             |
| `email_verified_at`         | System; nullable                                       | Server-generated timestamp after successful verification                                        | Reset when the verified email changes                                               |
| `phone_number`              | Optional initially; conditional later                  | Normalize to E.164 where supported; validate country code and ownership                         | Stored only while needed; remove or replace through an authenticated flow           |
| `phone_verified_at`         | System; nullable                                       | Server-generated after successful verification                                                  | Reset when phone number changes                                                     |
| `preferred_language`        | Optional with a sensible default                       | Must be in the supported-language list                                                          | Editable at any time                                                                |
| `auth_provider`             | Required per authentication identity                   | Allowlisted provider                                                                            | Added, changed, or revoked through secure account-linking flows                     |
| `provider_subject_id`       | Required for external-provider identities              | Unique per provider; never trust client-supplied identity claims without server-side validation | Retained while linked; unlink only after confirming an alternative recovery method  |
| `password_hash`             | Conditional                                            | Use a supported password-hashing algorithm and established authentication controls              | Replaced on password change; removed when native password authentication is retired |
| `traveler_enabled`          | Enabled by default unless policy dictates otherwise    | Server-side authorization                                                                       | Changes through role preferences or enforcement                                     |
| `local_enabled`             | Optional activation                                    | Must not grant restricted local capabilities by itself                                          | User activates; further checks may be required                                      |
| `local_onboarding_status`   | Conditional for local onboarding                       | Valid state transitions                                                                         | Updated during onboarding and review                                                |
| `profile_visibility`        | Required with a safe default                           | Allowlisted visibility settings                                                                 | Owner can change it; hidden profiles should leave discovery results promptly        |
| `verification_status`       | System-managed                                         | Must correspond to a valid verification record and trusted result                               | Updated after success, failure, expiry, or revocation                               |
| `created_at` / `updated_at` | System-managed                                         | Server-generated timestamps                                                                     | Created automatically; updates on relevant changes                                  |
| `closed_at`                 | Conditional                                            | Server-generated timestamp                                                                      | Set when closure completes, not merely when requested                               |

### Important implementation detail: do not conflate these states

A user may have a verified email but an unverified phone. They may have a verified phone but no identity check. They may be approved to publish listings while needing an additional check for a separate capability.

Therefore, keep these concepts independent:

- Authentication: Can the person securely access the account?
- Contact verification: Has the person demonstrated control of a particular email or phone?
- Identity verification: Has a defined process established the person's identity?
- Role activation: Has the user enabled traveler or local features?
- Capability approval: Is the user allowed to perform a particular action?
- Account status: Is the account active, restricted, suspended, or closed?

A single `is_verified` field cannot safely represent all six.

## 3. Consent and account lifecycle fields

These fields are important because Tour-op needs to manage user preferences, legal notices, account deletion, and security events independently.

| Field name                     | Description                                                            | Rationale                                                                    | Scope                |
| ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| `terms_acceptance_id`          | Unique record of an acceptance event                                   | Preserves evidence of the terms accepted.                                    | Account; restricted  |
| `terms_version`                | Version of the terms presented                                         | Helps establish which terms applied.                                         | Account; restricted  |
| `accepted_at`                  | Server timestamp of acceptance                                         | Records when acceptance occurred.                                            | Account; restricted  |
| `privacy_notice_version`       | Version of the privacy notice presented                                | Supports transparency and compliance records.                                | Account; restricted  |
| `marketing_opt_in`             | Optional marketing preference                                          | Separates promotional messages from necessary service communications.        | Account; private     |
| `marketing_consent_updated_at` | Timestamp of the latest marketing preference change                    | Supports preference history.                                                 | Account; system      |
| `deletion_requested_at`        | Timestamp of an account deletion request                               | Initiates a controlled deletion workflow.                                    | Account; private     |
| `deletion_status`              | Requested, processing, completed, or legally retained in part          | Prevents deletion from being treated as an instantaneous database operation. | Account; restricted  |
| `security_event_id`            | Identifier for an important security event                             | Supports investigation of suspicious access or account changes.              | Security; restricted |
| `event_type`                   | Event type, such as email change, login failure, or session revocation | Supports monitoring and incident response.                                   | Security; restricted |
| `event_created_at`             | Server timestamp of the event                                          | Provides an audit timeline.                                                  | Security; restricted |

### Lifecycle rules

1. Registration: create the account and authentication identity. Collect the display name and whichever login information the chosen authentication method requires.
2. Contact verification: mark an email or phone verified only after a successful server-validated verification process.
3. Role activation: allow the same account to activate local features without creating another account.
4. Local onboarding: request additional information only when the user attempts an action that requires it.
5. Account changes: changing a login email or phone triggers re-verification of the new contact method.
6. Suspension: block the affected capabilities while preserving access to any permitted account, support, or appeal functions.
7. Deletion: verify the request, revoke sessions, remove or anonymize data as appropriate, and retain only what applicable law requires. Inform the user of any relevant exceptions.

## 4. Legal and security concerns to flag before implementation

1\. Electronic identity verification for locals — high priority

Vietnam's E-Commerce Law, No. 122/2025/QH15, took effect on July 1, 2026. The Ministry of Industry and Trade's e-commerce authority stated on October 14, 2026, that from January 1, 2027, intermediate e-commerce platforms and social networks conducting e-commerce must electronically verify seller identities under the applicable electronic identification and authentication rules.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.idea.gov.vn\&sz=32)

idea.gov.vn

+1



Tour-op must determine whether its local providers fall within this requirement. Do not assume that email verification alone will satisfy it. Design the local onboarding workflow so that a required identity check can be completed before the relevant selling or publishing activity is allowed.

2\. Personal data protection

Vietnam's Personal Data Protection Law, No. 91/2025/QH15, has been effective since January 1, 2026.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://vbpl.moj.gov.vn\&sz=32)

VBPL

+1



Before collecting identity documents, location data, or other sensitive information, determine the lawful basis, notice and consent requirements where applicable, data-subject rights, security measures, retention periods, and any applicable impact-assessment or cross-border processing obligations. Do not assume that a single general consent checkbox covers every purpose.

3\. Access control and private fields

Hiding a field in React is not sufficient protection. The backend must enforce authorization for every account, profile, and verification endpoint. Public profile responses should use an explicit field allowlist. Administrative access to identity evidence should be restricted and auditable.

4\. Account linking and recovery

A user may authenticate through Google and later add another sign-in method. Require proof of control and an appropriate re-authentication step before linking or unlinking identities. Never merge accounts based solely on a matching email string supplied by the client.

5\. Retention and deletion

Identity evidence, security logs, support records, and transaction records may have different retention needs. Define retention by data category rather than keeping everything indefinitely. Deletion workflows should also address backups, third-party providers, and any legally required exceptions.

These are implementation flags, not a certification that the product complies with Vietnamese law. The exact requirements should be checked against the applicable legislation and implementing guidance before the local-provider onboarding workflow is released.

## 5. Recommended initial implementation

I would organize the database into these logical entities:

`users`

user_id · account_status · created_at · updated_at

`auth_identities`

Provider, provider subject, authentication linkage

`user_profiles`

Display name, avatar, bio, public visibility

`user_contacts`

Email, phone, verification timestamps

`user_roles`

Traveler/local activation and onboarding state

`verifications`

Check type, status, provider, evidence reference

`consent_records`

Notice/terms versions, purpose, acceptance event

Supporting entities

`security_events` · `deletion_requests` · `role_capabilities`

This is a logical model, not a requirement to create exactly eight database tables. Some fields can be combined safely depending on your authentication provider and database, but authentication, public profile information, and identity-verification evidence should remain separate security boundaries.

### Proposed MVP defaults

- One account, multiple roles.
- Display name required; legal name not public.
- Email verification required for email-based registration; provider-based login must be validated by the server.
- Phone number optional until a defined workflow requires it.
- No identity-document upload during ordinary registration.
- Local onboarding has an independent verification gate before legally restricted activities.
- No public exposure of private contact details or identity evidence.
- Explicit account deletion and session revocation workflows.
- The same backend validation and authorization rules for web and Android.

Next step: finalize the verification gate for local providers. Because the January 1, 2027 deadline is approaching, that decision may affect your onboarding screens, provider selection, and database design more than any other account field.