# CleanMap service setup and security boundary

## What is implemented

The repository uses Supabase Auth for citizen and authority sign-in. A `public.profiles` row is created for each Auth user; RLS allows each signed-in user to read only their own profile, and clients cannot change roles or authority scope. The Express API validates the Supabase access token and reads that profile before each protected operation. It continues to enforce citizen ownership, authority department/jurisdiction scope, an audited status workflow, restricted notes, and private evidence files. Complaint records and private uploads remain in SQLite and local disk.

SQLite and private uploads are stored under the server user's `~/.cleanmap/data` directory by default, outside the project and static web root. Configure an exact ward mapping in the server environment before expecting authorities to receive reports. Any unmapped ward is stored as `unassigned`; it will not be returned to an authority queue. Assignment never trusts a role or jurisdiction submitted by the browser.

This is a deployable starting service, not a production certification. It currently uses one SQLite file and local disk for evidence. Production use requires durable private storage, backups, monitoring, retention/deletion operations, account recovery and password changes, administrator access controls, deployment hardening, and a security/privacy review.

## Local setup on Windows

1. Copy `.env.example` to `.env` in PowerShell with `Copy-Item .env.example .env`. Set the Supabase project URL and publishable key in both the `VITE_` and server variables. Configure `CLIENT_ORIGIN` to the exact client origin and `JURISDICTION_MAP_JSON` only with verified department and jurisdiction assignments. Unmapped areas remain unassigned. In the Supabase Dashboard, set Auth Site URL and the redirect allowlist to include `http://localhost:3000/citizen/login` and the deployed client URL before enabling email confirmation.
2. In PowerShell, set up and start the API in one terminal:

   ```powershell
   cd C:\Users\acer\Downloads\new_repo-main\new_repo-main
   npm.cmd install
   npm.cmd run dev:api
   ```

3. Start the Vite client in another terminal:

   ```powershell
   cd C:\Users\acer\Downloads\new_repo-main\new_repo-main
   npm.cmd run dev
   ```

   Vite proxies `/api` to `http://localhost:3001`. Open `http://localhost:3000`.

4. Create an authority account from a trusted administrator terminal. Set `SUPABASE_SECRET_KEY` only in that server environment, never in a `VITE_` variable. The command creates a confirmed Supabase Auth account, applies the authority role and verified scope to its profile, and prints a unique initial password once; distribute it using a secure channel and protect shell history/output:

   ```powershell
   npm.cmd run provision-authority -- "staff@example.org" "Authority Staff" "sanitation" "ward-12"
   ```

   The department and each jurisdiction must match a server-controlled entry in `JURISDICTION_MAP_JSON`. The command does not grant global access.

The example configuration contains no ward-to-jurisdiction assignments. Configure only assignments confirmed by the service operator; do not let end users control this environment configuration.

## API and access rules

- Sign-in and citizen signup are proxied through the API to Supabase Auth. Sign-in is limited to 10 attempts per IP per 15 minutes; signup is limited to 5 attempts per IP per hour, in addition to Supabase Auth limits. Citizen profiles default to `role = 'citizen'`; a signup cannot set its own role or authority scope. Authority accounts are created through the trusted provisioning command.
- `GET /api/auth/session` validates the bearer token with Supabase Auth and reads the matching RLS-protected profile. Protected API routes repeat these checks on every request; browser state alone never grants access.
- Supabase access and refresh tokens are stored in browser local storage and refreshed before expiry. The Supabase publishable key is public. Never expose `SUPABASE_SECRET_KEY` or a legacy `service_role` key in the browser.
- Mutating and protected browser API requests require the exact `CLIENT_ORIGIN`. CORS only allows that origin and the bearer authorization header. The API has Helmet security headers and rate limits for API use and uploads.
- Citizens can list and access only their own reports. Complaint reference numbers are not credentials.
- Authorities can see a report only when the server-mapped department and jurisdiction match the account's provisioned scope. Every status and evidence operation checks that scope again.
- Status transitions are validated by the API: `Submitted → Under Review → In Progress → Resolved`; `Needs Information` and `Rejected` are supported from selected review states. Reasons are mandatory for `Needs Information`, `Rejected`, and `Resolved`. Each transition creates a server-timestamped history row with the actor.
- Internal notes are stored separately and the citizen API never selects or returns them.
- Evidence accepts JPEG, PNG, and WebP up to 5 MB, checks MIME and file signatures, stores files outside the web root, and serves them only through authenticated owner/scope-checked endpoints. Metadata stripping and advanced image re-encoding are not implemented yet.
- Complaint text and coordinates are validated. Exact location and uploaded evidence remain private to the owner and authorized jurisdiction.

## Environment settings

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `3001` |
| `CLIENT_ORIGIN` | Exact browser origin allowed by CORS and mutation checks; local default `http://localhost:3000` |
| `CLEANMAP_DATA_DIR` | Directory for the SQLite database and private evidence; defaults to `.cleanmap/data` under the server user's home directory |
| `CLEANMAP_DB_PATH` | Optional explicit database path overriding the directory default |
| `TRUST_PROXY_HOPS` | Number of trusted reverse proxy hops before the API; configure to match the production host so IP rate limits use the client address |
| `VITE_SUPABASE_URL` | Supabase project URL used by the browser Auth client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key; safe to expose in the browser |
| `SUPABASE_URL` | Project URL used by the API for token validation and profile lookup |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable API key used by the API alongside the user's bearer token |
| `SUPABASE_SECRET_KEY` | Server-only key required by the trusted authority provisioning command |
| `JURISDICTION_MAP_JSON` | Server-controlled JSON mapping exact ward labels to `{ "department", "jurisdiction" }` |
| `VITE_CLEANMAP_API_URL` | Optional public API base URL for a separately hosted API; leave unset for Vite's local proxy |

The API does not need a Supabase secret key for normal request authentication. Keep the authority provisioning secret in a trusted operator environment. Existing SQLite account/session tables may remain in older data directories, but authentication no longer reads them.

For production, set `NODE_ENV=production`, terminate HTTPS at a trusted proxy, set the exact HTTPS `CLIENT_ORIGIN`, configure the production Auth Site URL and redirect allowlist, and use persistent encrypted storage and protected backups. Point the client and API to the same Supabase project. Do not deploy this server on public infrastructure without operational controls or review.

## Verification

Run:

```powershell
npm run lint
npm run build
npm test
```

The Supabase `public.profiles` table was created with RLS enabled. A database privilege query confirmed authenticated users can select but cannot update profiles. Existing API integration tests cover the earlier SQLite login flow and need Supabase test credentials and bearer-token fixtures before they can be used with the new Auth flow.

## Privacy and legal review

Reverse geocoding in the current frontend sends selected coordinates to OpenStreetMap Nominatim. Decide whether that external processing is appropriate and disclose it before real-world use. Evidence metadata is not stripped yet; add image decoding/re-encoding before operational handling of sensitive photos. Add a retention and deletion policy and a user account/data deletion procedure.

This project does not claim legal compliance. As of 15 October 2026, the Central Government has notified phased commencement of the DPDP Act through G.S.R. 843(E), dated 13 November 2025; the notified timeline defers the main processing obligations in sections 3–17 and related provisions until 18 months after publication. The Digital Personal Data Protection Rules, 2025 were notified on 14 November 2025, with a separate enforcement timeline. Check the latest Gazette notifications and corrigenda at launch time, and obtain current legal and security review of notice and consent duties, user rights, retention, grievance handling, incident response, and sectoral obligations.

Official sources: [G.S.R. 843(E) commencement notification](https://egazette.gov.in/WriteReadData/2025/267647.pdf), [MeitY Digital Personal Data Protection Rules, 2025 and enforcement timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa).

