# Tour-op: Entry Fields & Displayed Information Specification

Before unifying Tour-op's UI and database, I suggest we agree on a field-level product specification. The goal is not simply to make the web and mobile app look consistent. Every field should have a clear purpose, a defined audience, an appropriate privacy level, and a reason to exist.

For Tour-op, this matters because the product connects travelers with local people who share their knowledge of a city. The system must support matching by interests, transparent pricing, trust, safety, and eventually transactions—without collecting unnecessary personal information or making promises that the product cannot fulfill.

I'll treat your current direction as the baseline:

- Two user groups: travelers and locals offering experiences.
- Trust by design: profiles, reviews, in-app communication, verification where implemented, and safety/dispute handling.
- Privacy: personal contact details should not be publicly displayed.
- Business model: Tour-op may facilitate bookings and earn a commission on completed transactions.
- Product constraint: the web and Android app should eventually use a consistent data model, while presenting different interfaces where appropriate.

## 1. How we should classify every field

Each field in the specification should have these attributes.

| Attribute             | What it means                                                                 |
| --------------------- | ----------------------------------------------------------------------------- |
| Field name            | Stable name for the UI/API/database contract                                  |
| Field description     | What the user enters or what the system displays                              |
| Why include / exclude | The user need, safety benefit, operational purpose, or reason to avoid it     |
| Scope                 | Where it applies: traveler, local, both, trip, booking, review, or admin      |
| Visibility            | Public, matched users, booking participants, owner only, or authorized staff  |
| Requirement           | Required, optional, conditional, or system-generated                          |
| Validation            | Accepted format, limits, allowed values, and business rules                   |
| Lifecycle             | When it becomes available, who can edit it, and when it expires or is deleted |

The list you requested—field name, description, why, and scope—will be the core. The additional attributes will help us avoid expensive database changes later.

One important distinction: a field a user enters is not necessarily a field another user should see. For example, Tour-op may need a phone number for account security or support, but that does not mean the phone number belongs on a public profile.

## 2. Account registration and identity

Principle: collect the minimum information needed to create an account. Do not make every user complete a long form before they can explore the app.

Scope codes: Both = traveler and local · Private = account owner / authorized operations · Conditional = required only for a specific feature or situation.

[User Contact Symbol. User with email icon. Email envelope mail message](https://images.openai.com/static-rsc-4/5b1SL5HW_TeJHx9hbuvr1ADUVO1G8MIxwZbPwlZzK_M0-4CIIRgup93w2r5HVBY5qo02-9HuBzLNYfoRM6wBqz2N2TV9JsXAGwwib71kVJIUGb_nuzbTGf4jnSj6E92VaEPlrODA7Pg24HzMJ-IHD7meQM2qByeCZkJZAglA9PgWJBnut1R8Z23GDM4HdV4J?purpose=inline)

1\. `email`

Description: Email used for login, account recovery, and important notifications.

- Why: Supports account recovery and communication.
- Why not: Do not expose it on public profiles.
- Scope: Both; private.
- Requirement: Required if email authentication is used.
- Validation: Valid format, normalized address, verification status.

[phone vector icon. phone editable stroke. phone linear symbol for use on web and mobile apps, logo, print media. Thin line illustration. Vector isolated outline drawing.](https://images.openai.com/static-rsc-4/FJZyXxyFHxZYvY1jeCOdQzaVD_DY-DC7SVNw6pjRlp-XHqlAcKzVZqo8boH5BKDiCAb6pkXMtEAVdO7oHdaZVavzi0YTLgv6gvXnFXOq8bDDYUN-Qu1wYKLmOhNMc3Jv62n9FEvSR8dw4nDDkcxVZm2qW-HWlDYAZLXPv8_yMarhhIDr_mq6MV7R8i72bGuO?purpose=inline)

2\. `phone_number`

Description: Phone number for account security or operational contact.

- Why: Useful for recovery, urgent support, and future verification.
- Why not: SMS adds cost; unnecessary collection increases privacy risk.
- Scope: Both; private.
- Requirement: Optional initially; conditional if a feature genuinely requires it.
- Validation: Country code, normalized number, verification status.

[profile icon from blogger and influencer collection. Thin linear profile, person, male outline icon isolated on white background. Line vector profile sign, symbol for web and mobile.](https://images.openai.com/static-rsc-4/b9NbTaP3-qFVUAXsbTp4Nu9ESoTnQJklPTXkuXvF-4SG-DVF_QstlbAiZDvNZdZHdE8f1W8IHfkxy5N1raO0ccFJarVC1_JXvgl6RxyeTUcpRvuFtRtDXzmuvkEGJPsWNGHrCk5VsGyw5szZvV5NU86LxNL8FLQtiZmQFoKVTmXM6fpCXpkmZ3hx3xo9sY3A?purpose=inline)

3\. `display_name`

Description: Name or nickname displayed to other users.

- Why: Makes profiles and conversations recognizable.
- Why not: A full legal name can reveal unnecessary personal information.
- Scope: Both; public or audience-controlled.
- Requirement: Required.
- Validation: Length limits, safe text handling, impersonation reporting.

[ícone de Data de nascimento Generic Blue | Magnific (antes Freepik)](https://images.openai.com/static-rsc-4/V-YnUDL86OxeeuzUSarDG7J0zjhabKeEiYnu98gPGn4etj-b9RaA1KEKlmsRCNSFdhUy73fZHuLbaILMv22qJXF4OBwMwJlaEVimKPnOnXwiP0t_AGimfJWmp2rb_mnUM7uiz7-GK0xTpy4fp7NdQK5iOC129RabFWFU3bl5MhQ?purpose=inline)

4\. `date_of_birth`

Description: Date of birth, stored privately if necessary.

- Why: May support age eligibility and safeguarding requirements.
- Why not: Full birth dates are sensitive, unnecessary for ordinary matching, and create additional obligations.
- Scope: Both; private; conditional.
- Requirement: Do not require by default until age policy and legal requirements are established.
- Validation: Valid date, minimum eligible age, no future date.

[ID Card, Shield and Check Mark Line Icon. Editable Stroke Identity Verification and Security Vector Illustration](https://images.openai.com/static-rsc-4/yuhAl37g4wfG8ivuTibX-0CoaHyuFWhcEzJ9_CtAvPr37NcU6O40Ub7oVrRehOmXL9nDN-Y3l_iQtkmzsimUiy78JU7skMk9UUi0jvwzbiymDWSL0iv6FCTiIPV7nZdeqYm0UMG1roSlzTYeInW1V3rvFSGFfwUpIDpqhXkkwUeKe66SKkTmKplieD5RVBWe?purpose=inline)

5\. `verification_status`

Description: System-managed state indicating which checks have actually been completed.

- Why: Helps users evaluate trust before arranging a meeting.
- Why not: A generic “verified” badge can imply checks that never occurred.
- Scope: Both; selected status public, evidence private.
- Requirement: System-generated.
- Validation: Explicit verification types, provider, timestamps, expiry and revocation where relevant.

[Sign in to your Google Account on your iPhone or iPad - Google Search Help](https://images.openai.com/static-rsc-4/F5xfwhjmeSQghrxOWANjB2fC7psFuKSs2P7XOyABSPw0odU5v63efLBzH1ssFht2azA2NZqKcqFpagLNYtQBb0cKEvXKAePqqgVgSEGUypwDySMy8WDhSFEG6orfOiSTwI1St_mP6THo4ahYkTATgxVUZgTz2T3TarLwIIJSOAA?purpose=inline)

6\. `auth_provider`

Description: Authentication method, such as Google or email.

- Why: Supports consistent login across web and mobile.
- Why not: Do not store authentication secrets or provider tokens in public profile data.
- Scope: Both; private/system.
- Requirement: System-generated.
- Validation: Supported provider identifier and provider subject ID.

### 3. Public profile and discovery

The profile should help someone answer four questions quickly: Who is this person? What can they offer? Are we compatible? What will it cost?

| Field name           | Field description                                                      | Why include / exclude                                                                                                       | Scope                                 |
| -------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `avatar_url`         | Profile picture or avatar                                              | Include: recognition and trust. Allow avatars rather than requiring a real-face photograph.                                 | Both; public                          |
| `bio`                | Short personal introduction                                            | Include: helps users assess personality and expectations. Limit length and support reporting.                               | Both; public                          |
| `languages`          | Languages and optional proficiency                                     | Include: directly affects communication quality. Avoid claiming certified fluency without evidence.                         | Both; public                          |
| `interests`          | Structured interests, such as food, history, photography, or nightlife | Include: core input for interest-based matching. Avoid asking for sensitive personal interests.                             | Both; public or selected              |
| `city`               | Main city where the person offers or seeks experiences                 | Include: essential discovery filter. Avoid showing a home address.                                                          | Both; public at city level            |
| `service_areas`      | Neighborhoods or areas the local can cover                             | Include: establishes realistic availability and travel distance.                                                            | Local; public                         |
| `experience_summary` | Relevant experience, knowledge, and activities                         | Include: helps travelers compare potential hosts. Do not imply professional licensing or credentials without evidence.      | Local; public                         |
| `skills`             | Structured capabilities, such as food tours or photography walks       | Include: improves filtering and matching. Exclude unsupported claims and excessively broad categories.                      | Local; public                         |
| `profile_completion` | System-calculated completeness                                         | Include: guides onboarding. Do not use it as a substitute for verification or quality.                                      | Both; owner-facing, optionally public |
| `rating_average`     | Average eligible review score                                          | Include: social proof. Hide or qualify when there are too few reviews.                                                      | Both; public                          |
| `review_count`       | Number of eligible reviews                                             | Include: puts the average in context.                                                                                       | Both; public                          |
| `member_since`       | Account creation month/year                                            | Include: gives basic context. Do not present account age as proof of trustworthiness.                                       | Both; public                          |
| `last_active_at`     | Last activity timestamp                                                | Usually exclude exact timestamps. If needed, display coarse activity such as “Active recently,” with user privacy controls. | Both; optional                        |
| `identity_badges`    | Explicitly defined verification badges                                 | Include only for checks actually completed. Separate identity, phone, and other checks.                                     | Both; public status, private evidence |
| `response_rate`      | Percentage of eligible inquiries answered                              | Consider later: helps travelers understand responsiveness. Exclude until there is enough reliable data.                     | Local; public                         |
| `response_time`      | Typical response time                                                  | Consider later: useful for setting expectations. Use a representative period and adequate sample size.                      | Local; public                         |

UX recommendation: do not put every field on the first profile screen. Show avatar, display name, city, interests, languages, price where applicable, reviews, and meaningful verification statuses first. Put longer biographies and secondary details behind an expandable section.

## 4. Experience listings and prices

This is one of the most important sections for Tour-op. Based on the feedback you received during early testing, travelers need to understand what a local offers and the approximate cost before investing time in a conversation.

| Field name            | Field description                                          | Why include / exclude                                                                                           | Scope                                     |
| --------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `listing_id`          | Unique listing identifier                                  | Include for stable links, bookings, and reviews.                                                                | Listing; system                           |
| `title`               | Short name of the offered experience                       | Include: makes discovery understandable at a glance.                                                            | Local listing; public                     |
| `description`         | What the experience involves                               | Include: sets expectations. Provide prompts for inclusions, exclusions, and limitations.                        | Local listing; public                     |
| `category`            | Standardized experience category                           | Include: enables filters and consistent analytics.                                                              | Local listing; public                     |
| `interest_tags`       | Searchable topics and interests                            | Include: supports matching beyond fixed tour packages.                                                          | Local listing; public                     |
| `city`                | City in which the experience takes place                   | Include: required for discovery and geographic relevance.                                                       | Local listing; public                     |
| `meeting_area`        | Approximate meeting neighborhood or agreed meeting point   | Include: helps users assess convenience. Exact details may be revealed only after an appropriate booking stage. | Listing/booking; staged visibility        |
| `duration_minutes`    | Expected duration                                          | Include: helps users compare experiences and plan their day.                                                    | Local listing; public                     |
| `price_amount`        | Price for a defined unit, such as per person or per group  | Include: price visibility is important to conversion and transparency.                                          | Local listing; public                     |
| `currency`            | Currency code, such as VND or USD                          | Include: avoids ambiguity for international visitors. Display a clear conversion estimate only when relevant.   | Local listing; public                     |
| `pricing_unit`        | Per person, per group, per hour, or another defined unit   | Include: prevents misleading price comparisons.                                                                 | Local listing; public                     |
| `included_items`      | Items or services included in the quoted price             | Include: helps prevent misunderstandings and disputes.                                                          | Local listing; public                     |
| `excluded_items`      | Extra costs, such as entrance tickets or meals not covered | Include: reduces unexpected expenses.                                                                           | Local listing; public                     |
| `minimum_group_size`  | Minimum number of participants, if applicable              | Include only when it changes the price or feasibility.                                                          | Local listing; conditional                |
| `maximum_group_size`  | Maximum participants the local accepts                     | Include: helps manage capacity and safety.                                                                      | Local listing; public                     |
| `availability`        | Available dates and time slots                             | Include: essential when users can request or book a specific experience.                                        | Listing/availability; public              |
| `cancellation_policy` | Conditions for cancellation and refunds                    | Include before users commit or pay. Must agree with the actual transaction model and applicable law.            | Listing/booking; public before commitment |
| `listing_status`      | Draft, published, paused, or archived                      | Include: prevents unavailable listings from appearing as bookable.                                              | Listing; system/owner                     |
| `listing_images`      | Photos illustrating the experience                         | Include: supports decision-making. Require upload controls, permission to use images, and reporting.            | Local listing; public                     |

### A critical pricing decision

I recommend making the indicative price visible on the discovery card, rather than hiding it until after the traveler contacts the local.

For example:

[Saigon Culinary Journeys | Authentic Food Tours in Ho Chi Minh City](https://images.openai.com/static-rsc-4/J0zwbMjn0QU4e-MyXgx4wbDt0F57SUnsYo3QAnjtLo6rMonA-bSIKnFuUQutHTuX2t9fEpUNEnW3-ugi5s5r6nV7JdyDkvInCPcrzpeBWjcYtVIh-R-IPtJg9yj_cmZvZYFq-7U5kLK2C-Oih4rZNdR6ugmyRQINsIEZvoI0acg?purpose=inline)

## Local food discovery

Ho Chi Minh City · 2 hours

Food & culture · English, Vietnamese

# 350,000 VND&#x20;

/ person

Includes a guided walk. Food purchases are extra.

Reviews

Price disclosed

Illustrative UI only; this is not a real Tour-op listing or an established market price.

The example demonstrates the information hierarchy, not a final design. A real listing must distinguish the local's price, any platform fee, taxes where applicable, and the total amount payable. Do not advertise a low headline price if mandatory charges appear only later.

## 5. Traveler requests and matching

Tour-op should support travelers who have an idea of what they want without requiring them to know exactly which local or package to choose.

| Field name             | Field description                                         | Why include / exclude                                                                                                             | Scope                         |
| ---------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `request_title`        | Short description of the desired experience               | Include: makes the request understandable to locals.                                                                              | Traveler request              |
| `destination_city`     | City the traveler wants to explore                        | Include: fundamental matching constraint.                                                                                         | Traveler request              |
| `preferred_date`       | Desired date or date range                                | Include: enables availability matching. Allow flexible dates.                                                                     | Traveler request              |
| `preferred_time`       | Morning, afternoon, evening, or a specific time window    | Include: helps match schedules.                                                                                                   | Traveler request              |
| `group_size`           | Number of people traveling together                       | Include: affects pricing, suitability, and safety planning.                                                                       | Traveler request              |
| `budget_min`           | Lower end of the desired budget                           | Optional: helps filter unrealistic matches. Do not force users to disclose a budget.                                              | Traveler request              |
| `budget_max`           | Maximum desired budget                                    | Optional but useful for matching. Clearly state whether the budget is per person or total.                                        | Traveler request              |
| `budget_unit`          | Per person, per group, or per day                         | Include whenever budget fields are used.                                                                                          | Traveler request              |
| `interest_preferences` | Desired topics and activities                             | Include: differentiates Tour-op from generic tour listings.                                                                       | Traveler request              |
| `language_preference`  | Preferred language for communication                      | Include: helps determine compatibility.                                                                                           | Traveler request              |
| `accessibility_needs`  | Optional practical requirements relating to accessibility | Include only when useful to deliver the requested experience. Treat responses as private and limit access.                        | Traveler request; restricted  |
| `special_requests`     | Free-text requests or additional context                  | Optional: accommodates needs that structured fields cannot capture. Use length limits and warn against sharing sensitive details. | Traveler request              |
| `match_score`          | System-generated compatibility score                      | Consider later. Explain its meaning; do not imply objective safety or guarantee a successful match.                               | Matching engine               |
| `match_reasons`        | Human-readable reasons for a suggested match              | Include if matching is automated: e.g. shared interests, language, date availability.                                             | Matching engine; user-visible |
| `request_status`       | Draft, open, matched, booked, cancelled, or completed     | Include to keep UI, notifications, and business logic consistent.                                                                 | Traveler request; system      |

UX rule: progressively disclose optional fields. A traveler should be able to browse and explore before filling out a detailed request. When creating a request, ask for destination, date flexibility, group size, and interests first. Ask for budget and additional needs in a second step.

## 6. Booking, payments, and financial transparency

These fields become essential if Tour-op handles bookings or payments. If the current app only facilitates introductions, we should not prematurely implement a full payment system—but the data model should distinguish an inquiry from a confirmed transaction.

| Field name                   | Field description                                     | Why include / exclude                                                                                   | Scope                        |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `booking_id`                 | Unique booking identifier                             | Include: provides a reliable reference for both parties and support.                                    | Booking; system              |
| `traveler_id`                | Traveler associated with the booking                  | Include: establishes ownership and access control.                                                      | Booking; private             |
| `local_id`                   | Local associated with the booking                     | Include: identifies the service provider.                                                               | Booking; private             |
| `listing_id`                 | Listing being booked, if applicable                   | Include: preserves the agreed offer and listing reference.                                              | Booking                      |
| `scheduled_start_at`         | Agreed start date and time                            | Include: avoids scheduling ambiguity. Store a timezone-aware timestamp.                                 | Booking; participants        |
| `scheduled_end_at`           | Expected end time                                     | Include: supports planning and completion workflows.                                                    | Booking; participants        |
| `participant_count`          | Number of people covered                              | Include: confirms the scope of the agreement.                                                           | Booking; participants        |
| `agreed_price_amount`        | Price accepted by both parties                        | Include: snapshot the agreed price so later listing edits do not change an existing booking.            | Booking; participants        |
| `currency`                   | Currency of the transaction                           | Include: required for unambiguous accounting.                                                           | Booking; participants        |
| `platform_fee_amount`        | Tour-op's fee for the transaction                     | Include if the platform charges a fee; disclose the applicable amount or calculation before commitment. | Booking/finance              |
| `tax_amount`                 | Applicable taxes, where determined                    | Include when relevant to the transaction. Tax treatment needs professional review.                      | Booking/finance              |
| `total_payable_amount`       | Amount the payer must pay                             | Include: makes the final cost clear.                                                                    | Booking; participants        |
| `payment_status`             | Pending, paid, failed, refunded, or other valid state | Include if payments are integrated. Keep payment status separate from booking status.                   | Booking/finance; system      |
| `payment_provider_reference` | Provider transaction identifier                       | Include if needed for reconciliation. Never store raw card credentials or unnecessary payment secrets.  | Finance; restricted          |
| `payout_status`              | State of the payment due to the local                 | Include if Tour-op collects and distributes funds.                                                      | Finance; restricted          |
| `cancellation_reason`        | Reason for cancellation                               | Include when a cancellation occurs; use structured options and optional explanation.                    | Booking; restricted access   |
| `refund_amount`              | Amount refunded, if any                               | Include for financial reconciliation.                                                                   | Finance; restricted          |
| `completion_status`          | Whether the agreed experience was completed           | Include: supports eligible reviews, commission calculation, and dispute workflows.                      | Booking; participants/system |

A booking should preserve an immutable snapshot of the agreed price, relevant listing terms, and cancellation policy. Financial calculations should be derived consistently by the backend, not trusted from a client-submitted total.

## 7. Messaging, reviews, trust, and safety

These are core features, not decorative additions. They help both parties decide whether to meet and provide a record when something goes wrong.

| Field name                    | Field description                                                  | Why include / exclude                                                                                                                            | Scope                                                |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `conversation_id`             | Unique conversation identifier                                     | Include: connects messages to the right participants and, where applicable, a booking.                                                           | Messaging; system                                    |
| `sender_id`                   | Message sender                                                     | Include: required for message ownership and moderation.                                                                                          | Messaging; private                                   |
| `message_text`                | Text of the message                                                | Include: supports pre-booking questions and coordination. Apply reporting, blocking, and retention policies.                                     | Conversation participants                            |
| `message_created_at`          | Timestamp of message creation                                      | Include: establishes chronology for coordination and disputes.                                                                                   | Conversation participants                            |
| `attachment_url`              | Reference to an uploaded attachment                                | Conditional: useful for relevant images, but adds moderation and privacy risks.                                                                  | Conversation; access-controlled                      |
| `review_score`                | Structured rating of an eligible completed experience              | Include: helps future users compare experiences. Avoid reviews for transactions that never occurred.                                             | Review; public                                       |
| `review_text`                 | Written feedback about the experience                              | Include: provides context beyond a numeric score. Add moderation and reporting.                                                                  | Review; public                                       |
| `reviewer_id`                 | Author of a review                                                 | Include: supports authenticity and duplicate prevention.                                                                                         | Review; public identity should follow privacy policy |
| `reviewed_user_id`            | Person receiving the review                                        | Include: makes review ownership explicit.                                                                                                        | Review                                               |
| `review_eligibility`          | System determination of whether a user can review a booking        | Include: reduces fake and retaliatory reviews.                                                                                                   | Review; system                                       |
| `report_category`             | Reason for reporting a user, listing, message, or incident         | Include: provides a clear reporting path.                                                                                                        | Safety; restricted                                   |
| `report_description`          | Optional incident details                                          | Include: gives moderators context. Warn users not to include unnecessary sensitive information.                                                  | Safety; restricted                                   |
| `incident_status`             | Open, under review, resolved, or other defined state               | Include: allows accountable case handling.                                                                                                       | Safety/admin; restricted                             |
| `block_relationship`          | Record that one user has blocked another                           | Include: gives users control over unwanted contact.                                                                                              | Safety; private                                      |
| `location_sharing_enabled`    | Whether a user has explicitly enabled a location-sharing feature   | Conditional: supports agreed safety workflows.                                                                                                   | Safety; private                                      |
| `shared_location`             | Current or temporary location disclosed to an authorized recipient | Conditional: sensitive location data requires strict access, purpose, and retention controls.                                                    | Safety; restricted                                   |
| `location_sharing_expires_at` | When temporary location sharing ends                               | Include if location sharing exists. Prevent indefinite tracking by default.                                                                      | Safety; system                                       |
| `emergency_contact`           | Contact supplied for a safety-related workflow                     | Conditional: may help in a carefully designed feature, but creates additional privacy obligations.                                               | Safety; private                                      |
| `audit_event`                 | Record of important system actions                                 | Include: helps investigate abuse, payment disputes, and administrative changes. Avoid logging passwords, tokens, or unnecessary message content. | Admin/security; restricted                           |

### Safety information that should be visible before meeting

A traveler should be able to see:

- The local's public profile and relevant reviews.
- What checks have actually been completed.
- The experience details, meeting area, price, and cancellation conditions.
- How to report, block, or contact support.
- Any applicable booking status and agreed meeting details.

A local should also be able to see the information necessary to assess the request, understand the group size, communicate expectations, and manage the agreed experience.

Neither party should automatically receive the other's private email, phone number, identity documents, or live location merely because they viewed a profile. Exact access should follow the product's booking stage, consent, and safety policy.

## 8. Consent, legal disclosures, and operational records

These fields are easy to overlook when designing a UI, but they should be considered before implementation.

| Field name                      | Field description                                                                  | Why include / exclude                                                                                        | Scope                       |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `terms_version_accepted`        | Version of the applicable terms accepted by the user                               | Include: helps establish which terms applied at acceptance.                                                  | Both; private/system        |
| `terms_accepted_at`             | Timestamp of acceptance                                                            | Include: supports evidence of the acceptance event.                                                          | Both; private/system        |
| `privacy_notice_version`        | Version of the privacy notice presented                                            | Include: documents the notice associated with the user's activity.                                           | Both; private/system        |
| `consent_record`                | Record of consent where consent is the applicable legal basis                      | Include where required; distinguish consent from other legal grounds for processing.                         | Both; restricted            |
| `marketing_opt_in`              | Whether the user has opted into optional marketing                                 | Include if marketing messages are sent; keep separate from necessary service notifications.                  | Both; private               |
| `account_deletion_requested_at` | When a user requests account deletion                                              | Include: enables an accountable deletion workflow.                                                           | Both; private/system        |
| `retention_policy_id`           | Applicable retention rule for a data category                                      | Include: supports consistent lifecycle management.                                                           | All data categories; system |
| `moderation_status`             | State of a listing, profile, or report under review                                | Include: supports enforcement and appeal workflows.                                                          | Listing/profile; restricted |
| `tax_information`               | Tax-related information required for relevant obligations                          | Conditional: collect only where legally necessary for the operating and payment model.                       | Local/finance; restricted   |
| `platform_disclosure`           | Required platform identity, operating details, and transaction-related disclosures | Include as applicable to Tour-op's legal role. These may be platform-level settings rather than user fields. | Platform; public            |
| `support_case_id`               | Reference for a customer support case                                              | Include: lets users track an issue without exposing internal notes.                                          | Support; participants/admin |

### Regulatory implications for Tour-op in Vietnam

Two current laws are especially important to review before launch:

- Vietnam's Personal Data Protection Law, No. 91/2025/QH15, took effect on January 1, 2026. Tour-op's collection of contact details, identity checks, reviews, and location data should be designed around applicable processing grounds, transparency, security, data-subject rights, and retention requirements.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://vanban.chinhphu.vn\&sz=32)

  Văn Bản Chính Phủ

  +1

- Vietnam's Law on E-Commerce, No. 122/2025/QH15, took effect on July 1, 2026. It covers e-commerce activities and platform responsibilities. Tour-op should assess its notification or registration status, required disclosures, transaction workflows, and responsibilities according to its actual business model.&#x20;

  [image](https://www.google.com/s2/favicons?domain=https://en.baochinhphu.vn\&sz=32)

  en.baochinhphu.vn

  +1



This is product-design guidance, not a legal compliance determination. The exact obligations depend on how Tour-op operates, particularly whether it merely introduces users or facilitates bookings, collects payments, and distributes money.

## 9. What should be calculated rather than entered?

A major source of inconsistency between web, mobile, and database systems is allowing clients to submit values that should be derived by the backend.

| Field name                 | Description                                               | Why include / exclude                                                        | Scope           |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------- |
| `average_rating`           | Calculated from eligible reviews                          | Include as a derived value; do not accept arbitrary user-submitted averages. | Profile/listing |
| `review_count`             | Count of eligible reviews                                 | Include as a derived value.                                                  | Profile/listing |
| `profile_completion_score` | Percentage or level based on defined criteria             | Include if it helps onboarding; maintain one shared calculation.             | Profile         |
| `match_score`              | Compatibility estimate                                    | Include only with a documented algorithm and clear limitations.              | Matching        |
| `total_price`              | Computed from price, quantity, fees, and applicable taxes | Include as a backend-calculated amount.                                      | Booking         |
| `commission_amount`        | Platform commission under the applicable pricing rules    | Include if commission applies; keep fee rules versioned.                     | Finance         |
| `is_bookable`              | Whether a listing can currently be booked                 | Derive from publication status, availability, and relevant restrictions.     | Listing         |
| `verification_summary`     | Summary of completed verification checks                  | Derive from authoritative verification records.                              | Profile         |
| `unread_message_count`     | Number of unread messages for a user                      | Derive from message/read state.                                              | Messaging       |
| `created_at`, `updated_at` | Creation and last-update timestamps                       | System-managed for traceability.                                             | Most entities   |

## 10. Proposed UI scope for the first unified version

I would split the first release into six screens or functional areas.

A. Explore

Search by city, date, interests, language, and price. Show listing cards with indicative price, duration, local profile, reviews, and meaningful badges.

Essential

B. Profile

Avatar, display name, biography, city, languages, interests, relevant experience, reviews, and accurate verification status.

Essential

C. Request or listing creation

Short, guided forms with progressive disclosure, clear required fields, draft saving, and inline validation.

Essential

D. Communication

In-app messaging, participant controls, blocking/reporting, booking context, and clear notifications.

Essential

E. Booking and transaction

Agreed date, participant count, price breakdown, booking status, cancellation terms, and payment state if payments are supported.

Depends on current transaction model

F. Safety and administration

Reports, moderation, verification records, audit trails, support cases, retention rules, and incident handling.

