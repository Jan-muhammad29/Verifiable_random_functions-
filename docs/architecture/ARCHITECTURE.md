# Architecture and data flow - JSON storage edition

```mermaid
flowchart TD
  Browser[React UI - Organizer / Participant] -->|HTTPS REST| API[Node.js Express API]
  API --> Auth[Session, CSRF, rate limiting]
  API --> Crypto[ECVRF private key / proof generation]
  API --> Store[(Private JSON data file)]
  API -->|Precommitted round| Drand[drand Quicknet beacon]
  Browser -->|Public proof certificate| Verifier[Browser / CLI independent verifier]
  Verifier -->|optional online BLS validation| Drand
```

The frontend cannot access the ECVRF private key. The backend reads the secret from `backend/.env` (or managed secrets). It stores sessions, participants, commitments, key metadata, results and audit events in `backend/data/veridraw.json`.

## Registration to draw sequence

```mermaid
sequenceDiagram
  participant P as Participant
  participant O as Organizer
  participant API as Express server
  participant J as JSON storage
  participant D as drand
  participant V as Public verifier
  O->>API: Create raffle, fix future beacon round
  API->>J: Save OPEN raffle
  P->>API: Register entry
  API->>J: Add unique participant (serialized update)
  O->>API: Lock roster
  API->>J: Save sorted roster and hash atomically
  API-->>O: Public commitment JSON/hash
  Note over O: Publish hash externally BEFORE beacon reveal
  O->>API: Execute draw after scheduled round
  API->>J: Atomically claim DRAWING state
  API->>D: Fetch BLS-verified beacon
  API->>API: ECVRF prove and select index
  API->>J: Atomically persist DRAWN and certificate
  API-->>P: Winner, public input, proof, output
  P->>V: Verify proof and recompute winner
  V->>D: Optional authenticate beacon online
```

## Storage rules and trust model

- JSON file operations are serialized through a single backend-process write queue. Mutations use clone-then-write and same-directory atomic replacement. Errors do not publish partial in-memory mutations.
- **Single Node process** only. Parallel Node instances or external writers may overwrite each other. Do not edit the file while the server is running.
- The file must be private and stored on a durable disk. At rest it is not encrypted by this project; filesystem controls and backups matter.
- Key rotation uses stable public-key metadata; revocation prevents new draws using that key, while historical public proofs stay verifiable.
- External timestamped commitment publication is necessary for stronger fairness; server-side times alone do not prove early locking.
