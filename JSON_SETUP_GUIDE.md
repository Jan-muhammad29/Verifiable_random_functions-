# VeriDraw - Simple JSON storage setup (Windows 11 + VS Code)

## Optional fastest setup

After installing Node.js 22+ and extracting the ZIP, open the project folder and run this from PowerShell:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

The script asks for the organizer email/password once and generates your secure VRF seed automatically. It creates the private JSON file, installs dependencies, registers the organizer, and runs protocol/storage tests. Review the script before execution. If you prefer to control each step manually, continue below.

## 1. Check prerequisites

Install Node.js 22+ and VS Code. In a fresh **PowerShell** terminal:

```powershell
node --version
npm.cmd --version
```

No SQL Server, SSMS, MySQL, PostgreSQL, Docker, pgAdmin or SQL migration is needed.

## 2. Open and install

Extract the ZIP into `C:\Projects\VeriDraw_JSON` (avoid OneDrive-sync folders), then open that folder in VS Code. Your terminal must contain the root `package.json`. Run:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
npm.cmd run keys:generate
```

Copy the printed 64-character `VRF_PRIVATE_KEY_HEX` value into `backend/.env`. Do not paste example keys from tutorials.

## 3. Update backend/.env

```dotenv
DATA_FILE=./data/veridraw.json
VRF_PRIVATE_KEY_HEX=<paste the generated 64-character hex value>
ADMIN_EMAIL=organizer@example.test
ADMIN_PASSWORD=<choose a unique password at least 14 characters long>
FRONTEND_ORIGIN=http://127.0.0.1:5173
PORT=5000
HOST=127.0.0.1
NODE_ENV=development
ENABLE_DEMO=true
```

The placeholders in `<...>` are illustrative. **Do not include the angle brackets.**

## 4. Initialize local JSON data and organizer account

```powershell
npm.cmd run db:init
npm.cmd run db:admin
```

After this, `backend/data/veridraw.json` should exist automatically. Never upload it publicly: it contains security-sensitive data such as hashed passwords, session hashes and participant names. `backend/.env` and `backend/data/` are ignored by Git.

## 5. Test before launch

```powershell
npm.cmd run test:protocol
npm.cmd run test:storage
npm.cmd run test:crypto
npm.cmd run typecheck
npm.cmd run build
```

**If the ECVRF tests fail, stop and share the exact error.** These code paths have not been validated end-to-end in the authoring environment because npm downloads are unavailable there.

## 6. Start two terminals

**Terminal 1 (backend):**

```powershell
npm.cmd run dev:backend
```

API: http://127.0.0.1:5000/api/health

**Terminal 2 (frontend):**

```powershell
npm.cmd run dev:frontend
```

Open http://127.0.0.1:5173

If you change `ADMIN_PASSWORD`, rerun `npm.cmd run db:admin`; all existing login sessions will be invalidated. Your private data survives server restarts.

## 7. First demonstration

1. Open **Proof verification**, use **Generate local test case**, then **Run independent verification**. This uses a fixed demonstration input; it is *not* proof of a fair live raffle.
2. Go to **Raffle workspace**, log in with the admin email/password from `.env`.
3. Create a raffle with a draw time ~10 minutes in the future.
4. Register five entries: `p-001` Ali, `p-002` Ahmed, `p-003` Sara, `p-004` Fatima, `p-005` Hamza.
5. Lock the roster before the lock deadline, download the commitment JSON, and publish its hash in a separate timestamped record before the beacon round is released.
6. After the scheduled time, click **Execute scheduled ECVRF draw**. Internet is required to fetch verified drand randomness.
7. Download the certificate and verify it from the CLI:

```powershell
node verifier-cli/verify.mjs "C:\path\to\your-certificate.json" --online
```

8. Modify the `winnerId` in a **copy** of the certificate, then rerun verification. It must fail.

## 8. Test API workflow and production build

With backend running, configure smoke credentials in this PowerShell window:

```powershell
$env:ADMIN_EMAIL="organizer@example.test"
$env:ADMIN_PASSWORD=Read-Host "Organizer password"
npm.cmd run test:smoke
Remove-Item Env:\ADMIN_PASSWORD
```

To test compiled output, stop both development terminals and run:

```powershell
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:5000. `NODE_ENV=development` is fine for this *local compiled* check.

## 9. Back up JSON data

Stop the backend before manually copying the live file. Example:

```powershell
Copy-Item backend/data/veridraw.json "$HOME\Documents\veridraw-backup.json"
```

Do not edit the JSON file while the API is running; the running server caches its authoritative state. If JSON is corrupted, startup deliberately refuses to reset it silently. Restore from a backup. Only run **one backend process** against the file.

## 10. Cloud deployment caveat

The assignment requires an actual public site. JSON storage is straightforward locally, but a production host must provide a **persistent writable disk**: generic free ephemeral hosts can delete the file on restart/deploy. The included `render.yaml` models a single-instance service with a persistent disk, which may require a **paid** Render plan. Do not represent an ephemeral deployment as durable. Configure `DATA_FILE=/var/data/veridraw.json` on a mounted disk, `NODE_ENV=production`, `ENABLE_DEMO=false`, `FRONTEND_ORIGIN=https://your-actual-hostname`, and protected secrets. See `docs/DEPLOYMENT.md`.

## 11. Troubleshooting

| Error | Fix |
| --- | --- |
| `npm.ps1 cannot be loaded` | Run `npm.cmd` in PowerShell |
| `npm` / `node` not found | Install Node.js and reopen terminal |
| `Set VRF_PRIVATE_KEY_HEX` | Generate 32 random bytes via `npm.cmd run keys:generate` |
| `ADMIN_PASSWORD` too short | Choose a password of 14+ characters |
| `Login required` | Initialize admin via `npm.cmd run db:admin`, then log in |
| `EADDRINUSE 5000` | Another process uses port 5000; stop it |
| Frontend cannot fetch API | Start backend; check `frontend/vite.config.ts` proxy |
| JSON parse/format error | Stop process and restore backup; never upload secrets |
| Draw unavailable | Lock roster before deadline and wait for scheduled beacon |
| Beacon request fails | Check internet/drand accessibility; retry after service recovers |
| Changes disappear after cloud restart | Use a persistent mounted disk; not ephemeral storage |

**Remember:** the code, tests, report, and slides need actual runtime checks/screenshots before you submit them as completed academic evidence.
