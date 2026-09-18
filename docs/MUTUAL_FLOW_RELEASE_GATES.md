# MidPoint mutual meeting flow — protected rollout

Do not merge this branch into main or deploy until two-device regression testing passes. The backup/pre-mutual-flow branch preserves the starting code snapshot, not the live Supabase database, secrets, or hosting configuration.

## Existing behavior to preserve
- Sender creates session, shares working invite URL and join code.
- Receiver joins and grants location; both locations yield up to three places.
- Sender's selected place reaches receiver; directions open in Maps.
- Existing session deep links, expiry and error handling continue working.

## Proposed state machine
- waiting_for_receiver -> connected when receiver location is saved.
- connected -> proposed when sender chooses a place.
- proposed -> confirmed only after the OTHER participant explicitly accepts the current proposal.
- proposed -> proposed on counterproposal, with proposal author switched and the previous proposal invalidated; original proposer must accept.
- Rejecting without a counterproposal -> connected. Expired and confirmed are terminal unless a separate explicit new-meeting flow is implemented.

## Required backend work before enabling counterproposals
- Store proposal author/role, proposal version or ID, and atomic acceptance guarded by current proposal ID and expected state. Never trust an isSender URL parameter as authorization.
- Enforce token/session access, role authorization, expiration and transitions server-side with RLS or authenticated Edge Functions. Avoid exposing coordinates or invite tokens to unauthorized users.
- Confirm realtime publication and subscriptions; handle missed events by re-fetching on focus/reconnect.
- Review existing Supabase migrations and take a separately verified database backup before applying schema changes. Never commit secrets or backup data to this public repository.

## UI work
- Hide native stack header where a screen draws its own header; avoid duplicate arrows and '(tabs)' titles.
- Meeting cards selectable, one primary Send Proposal action; display awaiting response, accept, counterproposal, confirmed states clearly.
- Only show confirmed directions as final meeting instructions after both parties agree; maintain preview directions if explicitly labeled.
- Remove perpetual 'finding midpoint' text after places load.

## Regression tests (two physical devices)
1. Invite URL opens exact session, not home/404; join code works.
2. Receiver location permission granted/denied paths; sender and receiver suggestions agree.
3. Sender proposes A; receiver accepts A; both see confirmed A and Maps works.
4. Sender proposes A; receiver counterproposes B; sender accepts B; both see confirmed B.
5. Sender cannot accept own proposal; stale acceptance of A after B is proposed fails.
6. Expired/invalid token cannot read or mutate sessions; unrelated users cannot access coordinates.
7. Reconnect/reopen updates state; repeated taps cannot create duplicate or conflicting confirmation.
8. iOS/Android layouts show a single correct header; app download links hidden until live.

No production deployment or database mutation is authorized by this document alone.
