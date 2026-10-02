-- MidPoint mutual meeting flow
-- Apply only during the controlled rollout after a verified database backup.

alter table public.meet_sessions
  add column if not exists proposed_by text,
  add column if not exists sender_token text;

alter table public.meet_sessions
  drop constraint if exists meet_sessions_proposed_by_check;

alter table public.meet_sessions
  add constraint meet_sessions_proposed_by_check
  check (proposed_by is null or proposed_by in ('sender', 'receiver'));

-- sender_token is intentionally separate from invite_token. The sender credential
-- must never be included in the receiver's invite URL.
-- Existing rows remain null and continue to use the legacy flow until they expire.
