-- MidPoint mutual meeting flow
-- Run only after backing up the Supabase project/database.
-- Adds proposal ownership so either participant can propose/counter,
-- while the UI prevents a proposer from accepting their own proposal.

alter table public.meet_sessions
  add column if not exists proposed_by text;

alter table public.meet_sessions
  drop constraint if exists meet_sessions_proposed_by_check;

alter table public.meet_sessions
  add constraint meet_sessions_proposed_by_check
  check (proposed_by is null or proposed_by in ('sender', 'receiver'));

-- Existing pending proposals predate proposal ownership.
-- Leave them unowned rather than guessing which participant proposed them.
