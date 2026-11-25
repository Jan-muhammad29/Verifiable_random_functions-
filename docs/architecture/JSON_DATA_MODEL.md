# JSON data model

One private file (`backend/data/veridraw.json`) has these top-level arrays:

| Collection | Main fields | Purpose |
| --- | --- | --- |
| `admins` | id, email, password_salt, password_hash | Organizer authentication (scrypt hash only) |
| `sessions` | token_hash, admin_id, csrf_token, expires_at | Secure session tracking |
| `vrfKeys` | key_id, public_key_hex, suite, revoked_at | Public key history and revocation |
| `raffles` | id, status, beacon_round, lock_deadline, roster_hash, commitment_hash | Raffle state and commitments |
| `participants` | raffle_id, participant_code, display_name | Registrations |
| `drawResults` | raffle_id, certificate, winner_id | Single finalized draw result |
| `auditLogs` | actor, action, raffle_id, details, created_at | Limited security activity history |

The application enforces uniqueness and state transitions in code inside a serialized write queue (rather than SQL constraints). Each complete file update is committed with an atomic rename. There are no SQL tables or migrations.

Private VRF seeds are **not** stored in this file. They are read from the protected backend environment.
