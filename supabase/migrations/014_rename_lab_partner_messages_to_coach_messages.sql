-- The "AI Lab Partner" feature is being renamed to "Coach" so the term
-- "Lab Partner" can be reserved for the human Lab Partners Program. The
-- backing table, its trigger, and its index all get renamed in lockstep
-- with the code so the schema and code never disagree.
--
-- RLS policies on this table aren't named "lab_partner_*", so they don't
-- need to change. The free-form ledger reason "lab_partner_message" in
-- public.credit_ledger is left alone — historical rows preserve the old
-- label, new rows will record "coach_message" via the API.

alter table public.lab_partner_messages rename to coach_messages;

alter trigger set_lab_partner_messages_updated_at on public.coach_messages
  rename to set_coach_messages_updated_at;

alter index public.idx_lab_partner_messages_athlete_id
  rename to idx_coach_messages_athlete_id;
