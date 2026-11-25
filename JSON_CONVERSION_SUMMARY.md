# Conversion summary: SQL Server -> JSON file storage

Updated 25 November 2026. This is the JSON edition of the existing VeriDraw project.

## Removed

- SQL Server `mssql` driver and its types
- SQL connection settings, database creation/migration scripts and T-SQL schema
- Docker Compose SQL Server container and SQL Server CI service
- SSMS / SQL Server setup guide and SQL Server deployment assumptions

## Added or changed

- `backend/store/json-store.mjs` - serialized transactional JSON store with atomic same-directory replacement
- `backend/src/db.ts` - typed state read/update functions and audit append
- `backend/src/auth.ts` - sessions/admin authentication using JSON persistence
- `backend/src/raffles.ts` - participant registration, locking, winner claim/finalization using JSON updates
- `backend/src/crypto/keyManager.ts` - public key metadata and revocation using JSON storage
- `backend/scripts/init-json.mjs` - initialize local storage file
- `backend/scripts/create-admin.ts` - organizer account bootstrap
- `backend/store/json-store.test.mjs` - storage unit tests
- `setup-windows.ps1` - simplified interactive setup
- Updated CI, README, deployment instructions, report PDF and slides

## Unchanged cryptographic/public interface

- RFC 9381 ECVRF suite and public certificate format
- Canonical SHA-256 roster commitment and rejection-sampling winner calculation
- Future drand Quicknet beacon integration and online BLS checking
- React frontend, REST API routes and independent verifier

## Verification record

- 7/7 protocol tests: PASS (Node built-in test runner)
- 5/5 JSON file storage tests: PASS (Node built-in test runner)
- 11 TypeScript/TSX files: syntax transpilation successful (not a full typecheck)
- Not run here: `npm install`, full RFC 9381 ECVRF suite, TS typecheck, frontend/backend build, live API smoke test and cloud hosting. These require npm/host access; do not claim they passed.

## Limitations

Single API process only; private file requires backups and a persistent disk. No multiple replicas or shared-file concurrency. A stored JSON commitment alone does not prove early publication. Independent timestamping is required before the selected external randomness is revealed.
