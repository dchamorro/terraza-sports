/// Business-rule constants mirroring the spec.
library;

/// Operating window: slots run from [kFirstSlotHour] to [kLastSlotHour] (exclusive).
const int kFirstSlotHour = 5;   // 05:00 local
const int kLastSlotHour  = 22;  // last slot starts 21:00

/// Peak-hour windows (local hours, inclusive start, exclusive end).
/// Tennis household cap applies inside these windows.
const List<(int start, int end)> kPeakWindows = [
  (6, 8),   // 06:00–08:00
  (17, 19), // 17:00–19:00
];

/// School-hours block for minors: Mon–Fri 07:00–14:00 local.
const int kSchoolBlockStart = 7;
const int kSchoolBlockEnd   = 14;

/// How many days in advance a member may book.
const int kBookingWindowDays = 7;

/// Sparring partners can only be added within this many hours of slot start.
const int kSparringWindowHours = 12;

/// Court lights are available only for slots starting at or after this hour.
const int kLightsMinHour = 17;

/// Free refunded cancellations per member per calendar month.
const int kFreeCancellationsPerMonth = 2;

/// No-cancellation window before slot start.
const int kCancellationCutoffHours = 2;

/// Check-in grace period: no-show after this many minutes past slot start.
const int kNoShowMinutes = 15;
