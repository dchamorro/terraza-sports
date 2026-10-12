# Business Logic — Source of Truth

Oct 12, 2026 · @Danilo

This is the canonical document. The PRD, User Flows, and Data Model tabs reference these rules rather than restating them; when a rule changes, it changes here first. A CI/CD documentation gate enforces that any PR touching booking logic updates this file before it can merge — so there is never a delta between what is built, what rotating admins operate, and what members are told. Audiences: the build team, rotating club admins, and members checking current rules.

## 1. Inventory & slots

- **Resources:** tennis courts and bowling lanes.
- **Slot structure:** fixed one-hour slots.
- **Operating hours:** 5:00 a.m. to 10:00 p.m. — 17 slots per resource per day.
- Each slot is independently bookable per resource.

* **Peak hours:** 6:00–8:00 a.m. and 5:00–7:00 p.m. Peak hours drive the household cap in section 3.

## 2. Who can book

- **Members only.** Every booking is tied to a verified member account. Free-text names are not permitted (see section 7).
- **Roster source:** the app syncs or imports from the club's existing member system. The app never creates members. Admin/Front desk register dependents with a date of birth.
- **Dependents have their own accounts**, with rights by age (tiers update automatically on birthdays):

| Age | Login | Booking | Payment |
| --- | --- | --- | --- |
| Under 12 | None | Parent submits a request; an admin approves | Parent's card |
| 12–17 | Own login, web app | Own quota | Parent's card on file; parent is notified |
| 18+ | Own login | Full rights | Own payment method |

- **Guests:** a member requests a guest; the Sports Manager (Edmundo) or the backup admin approves. Approval arrives as an email with Approve / Decline buttons plus a link to the web app. Once approved, the guest gets a link to a simple web view of the reservation — no app install, no account.
- Open: auto-expiry time for unanswered guest requests, and whether a guest fee applies.

## 3. Booking limits

- **One active booking per person** (member or dependent account) at any time.
- Bookable **up to one week in advance**.
- **Household peak cap (tennis only):** during peak hours a household can hold **2 tennis courts** at once. The cap counts courts, not bookings or people — three family members can play on 2 courts. Bowling lanes are exempt.
- **School hours:** dependents under 18 cannot be booked **Mon–Fri, 7:00 a.m.–2:00 p.m.** An admin-maintained holiday and vacation calendar lifts the block.
- **Under-12 bookings** made through an admin request count toward the household peak cap.

## 4. Services & add-ons

- **Equipment rental** (racquets, shoes, balls).
- **Lessons / coaching:** coaches publish their own availability; a lesson books the court and the coach together.
- **Sparring partners:** club-approved partners publish availability like coaches, but have **no priority** — a court plus sparring partner can only be booked **within 12 hours of start**, so members get first claim on courts. Sparring counts toward the one active booking and the household peak cap.
- **Tennis court lights:** optional paid add-on, available only for tennis bookings **after 5:00 p.m.**
- Food & beverage: out of scope for v1.
- Coach payout tracking: out of scope for v1.

## 5. Payment

- **Full payment at booking, in-app**, through **BAC Credomatic**. All prices in **córdobas (NIO)**.
- **Not** billed to the member account or statement — deliberate, so revenue is cleanly attributable to the app and ROI is measurable.
- Add-ons (equipment, lessons, sparring, lights) are charged in the same checkout.
- **Price table:** court time, lights, equipment, lessons, sparring, and any guest fee live in one admin-editable table owned by the Sports Manager. Every change is logged, goes through the doc gate, and notifies the Tennis Committee.
- BAC integration details pending the documentation Danilo will provide.

## 6. Cancellation policy

- **Two refunded cancellations per account per calendar month.** From the 3rd cancellation on, no refund. The refund does not depend on how early you cancel.
- **No cancellations less than 2 hours before start.**
- **Check-in by QR** from the booking, scanned at the court or front desk; front desk can check in manually. No check-in **15 minutes after start** = no-show: the court is released and a strike is issued (section 7).

## 7. Anti-abuse

- **Root cause:** members booked under fake or children's names, then cancelled and rebooked under their own name to grab extra court time.
- **Prevention (built in):** verified accounts only (section 2), the household peak cap and school-hours block (section 3), and the sparring 12-hour window (section 4).

**Detection rules** — flagged by the system, confirmed by an admin before a strike applies:

- **Dependent swap:** a booking cancelled for one household member and rebooked for another member of the same household, same court and time, within 24 hours.
- **No-show:** no QR check-in 15 minutes after start. Applied automatically.
- New patterns are added through the Ideas & reports inbox (section 10) and the doc gate.

**Sanctions ladder** — blocks on making reservations:

| Offense | 1st | 2nd | 3rd |
| --- | --- | --- | --- |
| No-show | Warning | 7-day block | 30-day block |
| Cancel-rebook / dependent swap | Warning | 14-day block | 60-day block |
| Booking under another person's account | 14-day block | 60-day block | Committee review |
| Guest rule violation | Warning | No guests for 30 days | No guests for 90 days |

- **Erase windows:** a 1st strike is erased after **15 days**, a 2nd after **30 days**, a 3rd after **45 days**. Escalation counts only strikes not yet erased. Committee-review offenses stay for **12 months**.
- Erased strikes remain in an audit log visible only to the Sports Manager, with no further effect.
- **Every offense goes to the monthly Tennis Committee** report.
- Members can appeal to the Sports Manager; every waiver requires a logged reason.

## 8. Roles & admin

| Role | Can do |
| --- | --- |
| Sports Manager (Edmundo) | Everything: settings, price table, waivers, triage of ideas |
| Admin / Front desk (incl. backup approver) | Approve guests and under-12 requests, manual reservations (tournaments, maintenance), confirm strikes, QR / manual check-in, holiday calendar, register dependents |
| Tennis Committee | Read-only: offenses log, price changes, ideas inbox; publish news |
| Coach / Sparring partner | Manage their own availability only |

- **Tennis Committee notifications:** an auto-generated monthly report before each meeting (all offenses, strikes issued or waived, price changes), plus immediate alerts for committee-review offenses and price changes.

## 9. Advertising (architecture only in v1)

- Reserve a **lightweight ad-placement surface** in the architecture so ads can be added later.
- **Not built in v1** — scaffolding only.

## 10. Communication & feedback

- **Notifications:** push + email in v1; WhatsApp in v2. Approvals (guests, under-12 requests) arrive as emails with Approve / Decline buttons and a web app link.
- **Language:** Spanish by default, English toggle.
- **Ideas & reports inbox:** admins, the Sports Manager, and the committee submit new abuse patterns, rule ideas, and improvements; members use a simpler feedback form into the same inbox. The Sports Manager triages: New → Under review → Adopted / Declined. Adopted rule changes go through the doc gate.
- **News feed (v1):** the Sports Manager and committee publish posts with push, targeted to all members, tennis players, or bowlers — tournaments, maintenance, rule changes.
- **Surveys (v1.1):** multiple choice plus one comment field; results go to the committee.
