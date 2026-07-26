-- Replace the single due_date with a start_date/end_date range so notes can span
-- multiple days on the calendar. Existing due_date values become start_date.
alter table notes rename column due_date to start_date;
alter table notes add column end_date date null;
