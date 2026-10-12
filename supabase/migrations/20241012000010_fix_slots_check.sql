-- Fix slots_operating_hours CHECK constraint.
-- Original constraint used (hour+18)%24 < 17 which incorrectly blocked
-- slots at 17:00–21:00 Managua (last valid hour is 21:00).
-- Correct range: (utc_hour+18)%24 between 5 and 21.

alter table slots
  drop constraint slots_operating_hours;

alter table slots
  add constraint slots_operating_hours check (
    (extract(hour from starts_at)::int + 18) % 24 between 5 and 21
  );
