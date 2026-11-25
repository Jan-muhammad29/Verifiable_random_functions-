# Test plan - JSON storage edition

1. `npm install` (Node.js 22+ required).
2. `npm run db:init` and `npm run db:admin`: initialize JSON file and organizer credentials.
3. `npm run test:protocol`: test canonical roster, commitment hashes and unbiased winner index.
4. `npm run test:storage`: test serialized writes, atomic updates, successful reload, and rollback on failed mutation.
5. `npm run test:crypto`: RFC 9381 test vectors, invalid proofs, modified outputs/certificates.
6. `npm run typecheck && npm run build`: compile and build React frontend + Express backend.
7. `npm run dev:backend` then `npm run test:smoke`: validate auth, CSRF, participant registration, roster locking, premature draw rejection, demo proof verification.
8. Manually create and lock a real raffle; publish the commitment externally and perform a real post-beacon draw; validate certificate by browser and CLI `--online`.
9. Run `npm run security:bench`; capture actual timing output and screenshots.
10. If hosted, verify data persists after restart and check single backend instance.

**Execution status:** In the authoring environment, the dependency-free protocol and JSON storage tests ran successfully. Full ECVRF, npm build, integration and cloud deployment tests require package installation and live runtime and are **not yet verified**. Do not claim those tests passed until demonstrated.
