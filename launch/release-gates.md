# Release gates
- [ ] Confirm Apple and Google account ownership, identity verification and app records for com.midpointmeet.app.
- [ ] Link Expo project and configure production signing; do not commit credentials.
- [ ] Verify actual app icon and screenshots; remove unnecessary permissions after code audit.
- [ ] Build signed iOS IPA and Android AAB; record source commit and build IDs.
- [ ] Test clean installation, denied location permission, manual location entry, all categories, directions, invalid/expired invitation, cross-platform and browser invitation, slow network, and session privacy.
- [ ] Verify Supabase authorization, token expiry and rate limits; check location data handling, deletion and retention.
- [ ] Restrict Maps API keys, quotas and alerts; review database and API spend.
- [ ] Review actual data flows before completing privacy labels, data safety form and privacy policy; publish real support and privacy URLs.
- [ ] Verify store name and trademark availability.
- [ ] Start Play closed test if required: 12 opted-in testers for 14 continuous days; recruit 15–20 to allow attrition.
- [ ] TestFlight, review, release manually when gates pass.
- [ ] Confirm public store links and invitation attribution before starting marketing.
## Commands (after account setup and project linking)
npx eas-cli@latest build --platform all --profile production
npx eas-cli@latest submit --platform ios
Android first upload: Play Console testing track, or configured EAS Submit.
## Metrics
Track aggregate installs, meeting creation success, invitation acceptance, completed destination selections, repeat use, crashes and API cost. Avoid collecting exact coordinates or invitation tokens in analytics.
## Owner inputs
Developer account statuses; Expo project ownership; verified support email; public domain or existing landing page URL; real app screenshots; testers' opt-in; final legal and privacy review. No passwords or private keys in chat or repo.
