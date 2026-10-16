# CleanMap service setup and security boundary

## What is implemented

The repository now includes an Express API in `server/index.js`, persistent SQLite storage, server-side opaque sessions, bcrypt password hashes, citizen registration, a trusted authority provisioning command, department/jurisdiction-scoped authority queues, ownership-scoped citizen data, an audited status workflow, restricted notes, and private evidence files. The React client calls this API. Browser role values and report references do not grant access.

SQLite and private uploads are stored under the server user's `~/.cleanmap/data` directory by default, outside the project and static web root. Configure an exact ward mapping in the server environment before expecting authorities to receive reports. Any unmapped ward is stored as `unassigned`; it will not be returned to an authority queue. Assignment never trusts a role or jurisdiction submitted by the browser.

This is a deployable starting service, not a production certification. It currently uses one SQLite file and local disk for evidence. Production use requires durable private storage, backups, monitoring, retention/deletion operations, account recovery and password changes, administrator access controls, deployment hardening, and a security/privacy review.

## Local setup on Windows

1. Copy `.env.example` to `.env` in PowerShell with `Copy-Item .env.example .env`. Configure `JURISDICTION_MAP_JSON` only with verified department and jurisdiction assignments. Unmapped areas remain unassigned.
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

4. Create an authority account from a trusted administrator terminal. This generates a unique initial password and prints it once; distribute it using a secure channel and protect shell history/output:

   ```powershell
   npm.cmd run provision-authority -- "staff@example.org" "Authority Staff" "sanitation" "ward-12"
   ```

   The department and jurisdiction must match a server-controlled entry in `JURISDICTION_MAP_JSON`. The command does not grant global access. It must run against the same database path as the API.

The example configuration contains no ward-to-jurisdiction assignments. Configure only assignments confirmed by the service operator; do not let end users control this environment configuration.

## API and access rules

- `POST /api/auth/register` creates only citizens; the request's `role` field is ignored. Passwords must be at least 12 characters. Authority registration is not exposed.
- `POST /api/auth/login` checks stored credentials and derives the role from the account row. `expectedRole` is only a portal hint.
- `GET /api/auth/session` validates the server-side session. `POST /api/auth/logout` revokes it.
- Session tokens are random, stored as SHA-256 hashes, held in `HttpOnly` cookies, and expire after `SESSION_HOURS` (8 by default). The default cookie is `SameSite=Lax`; production cookies are `Secure` when `NODE_ENV=production`.
- Mutating browser requests require the exact `CLIENT_ORIGIN`. Credentialed CORS only allows that origin. The API has Helmet security headers and rate limits for API use, login, citizen signup, and uploads.
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
| `SESSION_HOURS` | Session lifetime from 1 to 24 hours; default `8` |
| `SESSION_SAME_SITE` | `lax` by default; `none` requires HTTPS and production mode |
| `JURISDICTION_MAP_JSON` | Server-controlled JSON mapping exact ward labels to `{ "department", "jurisdiction" }` |
| `VITE_CLEANMAP_API_URL` | Optional public API base URL for a separately hosted API; leave unset for Vite's local proxy |

No password, service key, or session signing secret is placed in the frontend. The current session uses generated opaque tokens and SQLite-backed hashes; if moving to a distributed deployment, replace local session storage with a shared managed session store.

For production, set `NODE_ENV=production`, terminate HTTPS at a trusted proxy, set the exact HTTPS `CLIENT_ORIGIN`, use persistent encrypted storage and protected backups, and configure the UI/API domain and cookie policy deliberately. If frontend and API are on different sites, `SESSION_SAME_SITE=none` is required and both must use HTTPS. Do not deploy this server on public infrastructure without operational controls and review.

## Verification

Run:

```powershell
npm run lint
npm run build
npm test
```

The API integration test starts an isolated server and checks citizen-only account creation, private ownership, authority provisioning/scope, role separation, allowed and rejected status updates, note access boundaries, and logout revocation.

## Privacy and legal review

Reverse geocoding in the current frontend sends selected coordinates to OpenStreetMap Nominatim. Decide whether that external processing is appropriate and disclose it before real-world use. Evidence metadata is not stripped yet; add image decoding/re-encoding before operational handling of sensitive photos. Add a retention and deletion policy and a user account/data deletion procedure.

This project does not claim legal compliance. As of 15 October 2026, the Central Government has notified phased commencement of the DPDP Act through G.S.R. 843(E), dated 13 November 2025; the notified timeline defers the main processing obligations in sections 3–17 and related provisions until 18 months after publication. The Digital Personal Data Protection Rules, 2025 were notified on 14 November 2025, with a separate enforcement timeline. Check the latest Gazette notifications and corrigenda at launch time, and obtain current legal and security review of notice and consent duties, user rights, retention, grievance handling, incident response, and sectoral obligations.

Official sources: [G.S.R. 843(E) commencement notification](https://egazette.gov.in/WriteReadData/2025/267647.pdf), [MeitY Digital Personal Data Protection Rules, 2025 and enforcement timeline](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa).
