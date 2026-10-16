# CleanMap Tripura

CleanMap is an independent civic complaint prototype for Tripura. It is not affiliated with a government body and does not file official municipal complaints.

The project includes a React/Vite client using Supabase Auth and an Express API with SQLite persistence, server-verified user profiles, citizen-only public registration, authority provisioning, complaint ownership checks, jurisdiction-scoped authority access, status history, restricted internal notes, and private evidence uploads.

## Run locally on Windows

In PowerShell, copy the configuration example and install dependencies:

```powershell
Copy-Item .env.example .env
npm.cmd install
```

Set the Supabase project URL and publishable key in both the `VITE_` and server variables in `.env`. Configure `CLIENT_ORIGIN` and `JURISDICTION_MAP_JSON` with the client origin and verified department and jurisdiction assignments. Unmapped areas remain unassigned. Add the local and production login URLs to Supabase Auth's redirect allowlist.

For a local run on Windows, double-click `start-local.cmd`. It opens separate API and web-server windows and keeps both running. Open `http://localhost:3000` after Vite prints its local URL.

To start them manually, use two PowerShell windows. In each window, first change to this project directory, then run the matching command:

```powershell
npm.cmd run dev:api
```

Start the frontend in a second PowerShell window:

```powershell
npm.cmd run dev
```

Open <http://localhost:3000>. Supabase Auth handles email confirmation; enable the redirect URL in Supabase if confirmation is required.

Provision authority accounts only through the trusted server-side command documented in [the secure integration guide](docs/secure-platform-integration.md). The command requires a server-only `SUPABASE_SECRET_KEY`; public registration creates citizen accounts only.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

This prototype has not been legally or security certified. Review the setup, privacy, operational, and deployment limitations in [the secure integration guide](docs/secure-platform-integration.md) before handling real complaint data.

This repository is licensed under the MIT License; see [LICENSE](LICENSE).

