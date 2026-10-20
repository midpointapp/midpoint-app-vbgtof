# MidPoint maintenance and launch runbook

## Current state (2026-10-19)
- GitHub repository: midpointapp/midpoint-app-vbgtof.
- Production code is not modified by this maintenance branch.
- Supabase project in supabase/config.toml: yryjvcilhnnchaieieby.
- Supabase project listing reported Midpointapp, New Midpoint Meet, and MidPoint Staging as INACTIVE. Confirm which project the deployed app actually uses before changing databases.
- Automated crash reporting, end-to-end invitation tests, analytics and verified backups are **not yet configured**.

## Crash monitoring
Recommended: Sentry Expo/React Native SDK, with DSN supplied through deployment environment settings (never commit secrets). Capture uncaught JS errors, native crashes, app version, platform, and navigation failures. Exclude precise locations, addresses, invitation tokens, personal data, and sensitive user content. Test a deliberate non-production exception before enabling production alerts.

## Critical end-to-end test cases
1. Sender creates a meeting and generates an invite.
2. Receiver opens invite on iOS and Android, installed and not installed.
3. Receiver accepts invite and both participants see the same session.
4. Sender proposes three locations; receiver selects or rejects.
5. Both users agree on one location, and navigation opens correctly.
6. Expired, malformed, or reused links fail gracefully.
7. No location permission: user gets a useful fallback.
8. Network disconnected / Supabase unavailable: no silent success or data loss.

The GitHub CI tests cover only launch configuration. Real flow tests need a working staging database and test devices or browser automation.

## Backups and recovery
1. Identify production Supabase project from the actual runtime environment.
2. Check plan and backup availability in Supabase dashboard; do not assume PITR or automatic backups are enabled.
3. Export schema and data securely to access-controlled storage; never commit customer data or credentials to GitHub.
4. Restore a sanitized backup into staging and test session creation.
5. Keep GitHub main protected; use PRs and tagged releases. Record a known-good deployment version and verify rollback with the hosting/build provider.

## Usage analytics
Recommended privacy-conscious events:
- app_open
- session_created
- invite_shared
- invite_opened
- participant_joined
- location_proposed
- location_selected
- mutual_agreement_completed
- navigation_opened
- flow_error

Use pseudonymous session IDs, avoid exact coordinates and invite URLs. Measure weekly active users, invite completion, agreement conversion and failures. Instrument the code only after confirming the current active session implementation.

## Release checklist
- Supabase production/staging reachable and correct project identified.
- Secrets audited, row-level security reviewed.
- CI passing; manual two-device invite tests passing.
- Crash alert test verified; analytics event counts verified.
- Backups and a restoration drill verified.
- Rollback instructions documented and tested.
