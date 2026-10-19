# CRITICAL: production session authorization must be fixed before public launch

Verified 2026-10-19 using read-only pg_policies query on New Midpoint Meet (kjlbcgjvruyrqvkdtljz):
- public.meet_sessions anon SELECT USING (true), UPDATE USING (true) WITH CHECK (true), INSERT WITH CHECK (true).
- public.session_places anon SELECT USING (true), UPDATE USING (true) WITH CHECK (true), INSERT WITH CHECK (true).
- authenticated ALL policies also use true.
- Both tables have RLS enabled, but permissive policies permit broad access; enabling RLS alone does not secure them.
- App validates invite token only **after** fetching row data. It also logs token/location values.

## Required safe remediation
1. Review all actual session operations and server function code; define sender and receiver authorization model.
2. On staging, implement token-validated server API endpoints for session create/read/join/propose/agree and places operations, with rate limiting and expiration enforcement. Do not trust a client-provided role flag.
3. Revoke direct client SELECT/UPDATE of private meeting rows; add minimal necessary policies or keep direct access blocked. Never use public unrestricted policies.
4. Remove invite tokens and precise coordinates from client logs and analytics.
5. Run negative authorization tests: no token, wrong token, expired token, different session, forged sender flag, repeated requests. Verify legitimate two-person flow.
6. Only after staging passes, migrate production with backup and rollback plan.

No production policy was changed.
