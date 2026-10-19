# Phase 2: launch validation findings (2026-10-19)

## Verified
- App runtime Supabase client uses `EXPO_PUBLIC_SUPABASE_URL` or fallback to **New Midpoint Meet** (`kjlbcgjvruyrqvkdtljz`). The .env.example agrees.
- `supabase/config.toml` points to an older paused project. Do **not** use it to deploy or migrate until the CLI project link is corrected.
- Production candidate and staging databases both answer SQL queries; both have meet_sessions and session_places. Their join, session-api and places-proxy functions are deployed.
- Production security advisor returned no findings. Staging advisor reported RLS enabled without policies; review intentional server-only access.

## Release blockers discovered in code review
1. **Privacy/security:** `app/session.tsx` and `app/session/[id].tsx` fetch complete meeting rows before validating invite tokens client-side. Client-side token comparisons do not protect database access. Audit production RLS and use token-validated server functions for reads/writes. Do not ship until authorized access is confirmed.
2. **Privacy:** `utils/sessionUtils.ts` logs invite tokens and sender coordinates. `app/session/[id].tsx` logs tokens and session payloads. Remove sensitive logs before release.
3. **Deep links:** Invite URL is hardcoded to `https://golden-biscochitos-cff794.netlify.app/`; test that domain and its redirect behavior on real iOS/Android devices. Avoid assuming the Natively preview URL is the invite destination.
4. **Multiple flows:** `app/session.tsx`, `app/session/[id].tsx`, and `app/meet-session.tsx` contain overlapping meeting flows; `app/meet-session.tsx` accesses `meet_points`, which is not present in either active public schema. Identify actual navigation paths and retire or redirect dead routes.
5. **Misleading offline messaging:** `app/_layout.tsx` tells users changes are saved locally and will sync, but this behavior is not established by the reviewed code.
6. **Unverified realtime:** confirm the relevant tables are included in Supabase realtime publication and subscriptions work across two devices.

## Test order
1. Verify production table RLS and Edge Function authorization without reading private customer data.
2. Confirm live join URL resolves to correct app route.
3. Exercise create -> invite -> join -> propose -> agree -> navigation with disposable test sessions.
4. Validate error handling for expired links, denied GPS permission and offline.
5. Enable crash monitoring and analytics, with no location/token payloads.
6. Test backup restoration and deployment rollback.

No production code or database was changed in this phase.
