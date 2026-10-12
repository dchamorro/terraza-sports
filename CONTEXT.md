# Terraza Sports — Booking Context

A country-club sports-facility booking platform. Members reserve tennis courts and bowling lanes by the hour, optionally attaching add-ons (equipment, coaching, sparring, lights). Payments are collected in full at booking time. Anti-abuse rules and an admin approval layer protect fair access.

## Language

### People

**Member**:
A verified club participant whose identity originates from the club's external member system. The app never creates Members — it only syncs or imports them.
_Avoid_: User, customer, player, client

**Dependent**:
A Member registered under a household by an admin, with rights determined automatically by age tier (Under-12, Minor, Adult). A Dependent has their own account distinct from the primary household Member.
_Avoid_: Child account, sub-account, family member

**Household**:
The set of Members and Dependents that share a primary membership. Used exclusively to enforce the peak-hour tennis court cap.
_Avoid_: Family, group, account family

**Guest**:
A non-member who may be brought by a Member. A Guest has no app account; once a Guest Booking is approved they receive a read-only web link to their Reservation.
_Avoid_: Visitor, external user

**Sports Manager**:
The single club role (currently Edmundo) with full administrative rights: price table, waivers, ideas triage, all settings.
_Avoid_: Super admin, owner

**Admin**:
A front-desk staff member who can approve Guest and Under-12 requests, manage the Holiday Calendar, perform manual check-in, and register Dependents.
_Avoid_: Staff, operator, clerk

**Coach**:
A club-approved instructor who publishes their own availability. A Lesson books a Court and a Coach together.
_Avoid_: Instructor, trainer

**Sparring Partner**:
A club-approved player who publishes availability. Unlike a Coach, a Sparring Partner has no booking priority — they may only be added to a Booking within 12 hours of the Slot start.
_Avoid_: Practice partner, hitting partner

### Facilities & Time

**Resource**:
A bookable physical asset — either a Tennis Court or a Bowling Lane.
_Avoid_: Facility, venue, space, court (as a generic term)

**Slot**:
A fixed one-hour window on a specific Resource on a specific date. There are 17 Slots per Resource per day (05:00–22:00). A Slot is either Available, Reserved, or Blocked.
_Avoid_: Time slot, interval, period, block (when meaning a bookable unit)

**Peak Hour**:
The windows 06:00–08:00 and 17:00–19:00. During Peak Hours the Household Tennis Cap applies.
_Avoid_: Rush hour, busy hour

**School Hours**:
Mon–Fri 07:00–14:00. Dependents under 18 may not hold a Slot during School Hours unless the Holiday Calendar lifts the restriction.
_Avoid_: Restricted hours, blocked hours

**Holiday Calendar**:
An admin-maintained list of dates on which the School Hours restriction is suspended.
_Avoid_: Vacation calendar, exception calendar

### Bookings

**Booking**:
The confirmed reservation of one Slot on one Resource by one Member or Dependent, optionally with Add-ons. A Booking is the unit of payment, check-in, cancellation, and anti-abuse tracking.
_Avoid_: Reservation (use only when referring to the guest-facing read-only view), appointment

**Reservation**:
The read-only web view sent to a Guest after their Booking is approved. Not a system entity — it is a rendered view of an approved Guest Booking.
_Avoid_: Booking (when referring specifically to the guest view)

**Add-on**:
An optional item attached to a Booking at checkout: Equipment Rental, Lesson, Sparring, or Court Lights. Each Add-on has its own eligibility rules.
_Avoid_: Extra, service, upsell

**Lesson**:
An Add-on that pairs a Booking with a Coach and their published availability. Booking a Lesson locks the Court and the Coach simultaneously.
_Avoid_: Coaching session, training

**Sparring**:
An Add-on that pairs a Booking with a Sparring Partner. Only bookable within 12 hours of Slot start.
_Avoid_: Practice session, hit

**Court Lights**:
A paid Add-on available only on Tennis Court Bookings starting at or after 17:00.
_Avoid_: Lighting, lights add-on

### Payments & Refunds

**Charge**:
The full in-app payment collected at the moment a Booking is confirmed, processed through BAC Credomatic in NIO.
_Avoid_: Payment, transaction, invoice

**Refund**:
The reversal of a Charge when a Booking is cancelled within the monthly free-cancellation allowance (2 per account per calendar month).
_Avoid_: Credit, reimbursement

### Anti-abuse

**Strike**:
A recorded offense on a Member or Dependent account, issued after admin confirmation (except No-show, which is automatic). Strikes feed the Sanctions Ladder.
_Avoid_: Penalty, violation, infraction

**No-show**:
A Strike issued automatically when a Member or Dependent has not checked in 15 minutes after the Slot start time.
_Avoid_: Absence, missed booking

**Dependent Swap**:
A detected pattern where a Booking is cancelled for one Household member and rebooked for another on the same Resource and Slot within 24 hours.
_Avoid_: Swap, transfer, reassignment

**Sanctions Ladder**:
The escalating consequence schedule (Warning → 7-day block → 30/60-day block → Committee review) applied per offense type based on unresolved Strike count.
_Avoid_: Penalty ladder, escalation matrix

### Admin & Governance

**Price Table**:
The single admin-editable table, owned by the Sports Manager, that lists the price of every billable item (court time, lights, equipment, lessons, sparring, guest fee). Every change is logged and notifies the Tennis Committee.
_Avoid_: Price list, rate card, tariff

**Ideas Inbox**:
A shared inbox where Members submit feedback and Admins/Committee submit rule ideas or abuse patterns. The Sports Manager triages items through New → Under Review → Adopted / Declined.
_Avoid_: Feedback inbox, suggestions box

**Waiver**:
A Sports Manager decision to dismiss a Strike or override a policy, with a mandatory logged reason.
_Avoid_: Exception, override, pardon
