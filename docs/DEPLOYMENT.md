# Deployment - JSON-file edition

VeriDraw can run on a single Node server and store data in one private JSON file. A durable **mounted writable disk** is mandatory for persistent raffles, registration and audit history. Free application containers with ephemeral filesystems are unsuitable for durable raffle data; they can delete files on restart/redeploy. Verify the chosen provider's pricing and storage policy before promising free hosting.

## Deployment steps

1. Run all local tests, TypeScript checks and the production build. Commit the **source**, but never `backend/.env` or `backend/data/`.
2. Push the repository to GitHub, then create a **single-instance** Node hosting service with a persistent disk. Do not scale the backend to multiple processes; its lock is in-process only.
3. Build: `npm install --no-audit --no-fund && npm run build`.
4. Start: `npm run db:init && npm run db:admin && npm start` (the included Render blueprint uses this bootstrap and resets sessions on each restart; suitable for classroom use, not a production credential lifecycle).
5. Set `DATA_FILE=/var/data/veridraw.json` and mount `/var/data` to the persistent disk. Set secure `VRF_PRIVATE_KEY_HEX`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_ORIGIN=https://your-real-domain`, `NODE_ENV=production`, `ENABLE_DEMO=false`.
6. Confirm HTTPS, `/api/health`, organizer login, registration, locking, first actual future-beacon draw and independent public verification. Publish commitment hash to an external timestamped medium before the beacon round.
7. Test backup/restore and verify that data survives a redeploy. Monitor disk use and run at most one API process.
8. Add the actual GitHub and deployed URLs to the course Topic Selection Sheet. Deploying and submitting have **not** been performed from this ZIP.

## Constraints

- Render persistent disks and comparable storage are often paid. The included `render.yaml` uses a persistent disk example, **not** an active hosted deployment.
- JSON files are not tamper-evident by themselves. An external precommitment is still needed.
- Do not expose the JSON file or secret key via the frontend, GitHub or static hosting.
- For genuinely high-traffic/multi-server deployment, migrate to durable shared storage (such as a database); this simplified version deliberately optimizes for one classroom service.
