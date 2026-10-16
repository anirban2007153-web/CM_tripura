# CleanMap Tripura

CleanMap is an independent civic complaint prototype for Tripura. It is not affiliated with a government body and does not file official municipal complaints.

The project includes a React/Vite client and an Express API with SQLite persistence, server-side sessions, citizen-only public registration, authority provisioning, complaint ownership checks, jurisdiction-scoped authority access, status history, restricted internal notes, and private evidence uploads.

## Run locally on Windows

In PowerShell, copy the configuration example and install dependencies:

```powershell
Copy-Item .env.example .env
npm.cmd install
```

Configure `JURISDICTION_MAP_JSON` in `.env` only with verified department and jurisdiction assignments. Unmapped areas remain unassigned.

Start the API in one PowerShell window:

```powershell
npm.cmd run dev:api
```

Start the frontend in a second PowerShell window:

```powershell
npm.cmd run dev
```

Open <http://localhost:3000>.

Provision authority accounts only through the trusted server-side command documented in [the secure integration guide](docs/secure-platform-integration.md). Public registration creates citizen accounts only.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
```

This prototype has not been legally or security certified. Review the setup, privacy, operational, and deployment limitations in [the secure integration guide](docs/secure-platform-integration.md) before handling real complaint data.

This repository is licensed under the MIT License; see [LICENSE](LICENSE).
