# VeriDraw - ECVRF raffle 

CS-3002 Information Security, Topic 15. This is a **single-process, JSON-file-backed** React + Express learning application. No SQL Server, SSMS, Docker, PostgreSQL, database account, or SQL migration is required. The cryptographic primitive is RFC 9381 `ECVRF-EDWARDS25519-SHA512-TAI` via a published JS implementation.

**Project scope:** organizer login, raffle creation, participant registration, locked canonical roster, SHA-256 commitment, preselected future drand Quicknet beacon, ECVRF draw, downloadable public certificate, browser + standalone CLI verification, security/tampering tests. The private VRF key stays on the server.

**Crucial limitation:** A valid ECVRF proof demonstrates correct computation *for fixed inputs*, not fair input selection. The organizer must publish the commitment hash in a timestamped external location **before** the selected beacon round. Internal timestamps are not independent evidence. The organizer can still decline to execute an unfavorable draw. The offline verifier checks mathematics; `--online` separately checks the drand beacon signature. This is an educational implementation, not a certified real-money raffle.

## Fast setup on Windows

Extract this ZIP, open the folder in VS Code and run `powershell.exe -ExecutionPolicy Bypass -File .\setup-windows.ps1`. The setup prompts for your organizer credentials, generates a secure VRF seed without printing it, installs dependencies, creates the JSON file and runs the first tests. Review the script before execution. If you prefer manual configuration, follow the instructions below.

## Install and run manually on Windows (VS Code)

1. Install **Node.js 22+**, VS Code and Git (optional for local use).
2. Open this folder in VS Code. In PowerShell, run `npm.cmd install`.
3. Run `Copy-Item backend/.env.example backend/.env`.
4. Run `npm.cmd run keys:generate`. Copy the newly generated 64-character hexadecimal seed after `VRF_PRIVATE_KEY_HEX=` into `backend/.env`. Never share the value.
5. In `backend/.env`, replace `ADMIN_PASSWORD` with a strong unique password (14+ characters); adjust `ADMIN_EMAIL` if desired.
6. Run `npm.cmd run db:init` to create `backend/data/veridraw.json` (the file is ignored by Git).
7. Run `npm.cmd run db:admin` to create or update the organizer account.
8. Run `npm.cmd run test:protocol`, `npm.cmd run test:storage`, `npm.cmd run test:crypto`, `npm.cmd run typecheck`, `npm.cmd run build`.
9. **Terminal 1:** `npm.cmd run dev:backend`. **Terminal 2:** `npm.cmd run dev:frontend`.
10. Browse to **http://127.0.0.1:5173**; API check: **http://127.0.0.1:5000/api/health**.

See [JSON_SETUP_GUIDE.md](JSON_SETUP_GUIDE.md) for a detailed walkthrough, test/demo sequence, troubleshooting, and cloud storage caveats.

## JSON data file

All organizer accounts, sessions, key metadata, raffles, participant entries, commitments, draw results, and audit log entries are saved to `backend/data/veridraw.json` (or `DATA_FILE` from `backend/.env`). The file is written through a **serialized single-process write queue** and replaced atomically, so one request cannot overwrite another within a single Node instance. A failed transaction does not update the snapshot.

**Limits:** One backend process only; no multi-instance writes or multi-machine synchronization; JSON is not inherently tamper-proof and is not a trusted external commitment log. Keep the file out of Git, make regular backups, control OS file permissions, and use a persistent disk for public hosting. File storage without a durable mounted volume on free/ephemeral cloud hosts will lose data on restart or redeploy.

## Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd install` | Install workspaces and cryptographic dependencies |
| `npm.cmd run db:init` | Create or read the private JSON store |
| `npm.cmd run db:admin` | Create/update organizer and invalidate old sessions |
| `npm.cmd run keys:generate` | Print a cryptographically random 32-byte seed |
| `npm.cmd run test:protocol` | Canonical roster, commitments, input encoding and draw index |
| `npm.cmd run test:storage` | Atomic file persistence, rollback and serialized writes |
| `npm.cmd run test:crypto` | RFC 9381 official vectors and invalid-proof tests |
| `npm.cmd run test:smoke` | Integration test against running backend (demo must be enabled) |
| `npm.cmd run typecheck` | TypeScript static checks |
| `npm.cmd run build` | Production build (backend + frontend) |
| `npm.cmd start` | Serve compiled application on one origin, port 5000 |
| `npm.cmd run security:bench` | Sample cryptography/roster benchmarks |

No `db:migrate`, SQL queries, SQL login, or SQL client are needed.

## Raffle walkthrough

- Organizer signs in and creates a raffle for a future time (at least 2 minutes away).
- Participants register unique public IDs and names; organizer downloads roster and locks before the deadline.
- Locking stores canonical roster and public commitment. Publish its hash **outside** the app with a trustworthy early timestamp.
- After the preselected drand round, organizer clicks Draw. Backend verifies the beacon, evaluates ECVRF, applies rejection sampling, and saves one final result.
- Every participant may download and verify the public certificate. Example: `node verifier-cli/verify.mjs path/to/certificate.json --online`.
- In demo mode only, `POST /api/demo/draw` creates a fixed-input teaching certificate, **not a fair live raffle**.

## Documentation

- [Setup guide](JSON_SETUP_GUIDE.md)
- [Architecture and DFD](docs/architecture/ARCHITECTURE.md)
- [Security threat model](docs/security/THREAT_MODEL.md)
- [Test plan](docs/TEST_PLAN.md)
- [Team division](docs/team/WORKSTREAMS.md)
- [Deployment limitations](docs/DEPLOYMENT.md)
- `docs/report/` and `docs/presentation/` for accompanying academic documents.

## Requirements / submission

The assignment requires exactly three members, cryptographic algorithm, usable frontend, backend and persistence as applicable, threat model, attack demonstrations, GitHub and live cloud hosting, PDF report, presentation, live demo and group Q&A. This ZIP is **not** a public deployment. Complete account-based hosting and provide real screenshots and timings before claiming production deployment, and add your repository and hosted URLs to the Topic Selection Sheet.

Sources: [RFC 9381](https://www.rfc-editor.org/rfc/rfc9381.html), [ECVRF candidate implementation](https://github.com/collectorcrypt/cc-vrf/tree/main/packages/ecvrf), [drand](https://drand.love/developer).
