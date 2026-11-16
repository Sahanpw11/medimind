# MongoDB schema rationale

Database `medimind_db`, 11 collections plus the GridFS bucket `documents`. All references are BSON `ObjectId`, all timestamps are BSON `Date`, and workflow states are enumerations enforced by JSON Schema.

## Embed vs reference

The rule applied everywhere: **embed what is bounded, always read with its parent and rarely queried alone; reference what grows without bound, is sensitive, or is queried independently.**

| Data | Decision | Reasoning |
|---|---|---|
| Patient demographics, address, emergency contact | **Embedded** in `patients` | One-to-one, a few hundred bytes, always shown with the profile. One read, atomic update. |
| Patient allergies | **Embedded array**, capped at 50 by the validator | A patient has a handful. `$elemMatch` / multikey index answers "who is allergic to X" without a join. The cap makes growth bounded. |
| Doctor weekly availability | **Embedded array** (max 7 entries) | Tiny, read on every booking, updated as a unit. |
| Appointments | **Referenced** (`patientId`, `doctorId`) | Unbounded growth per patient and per doctor (this seed: 2,200). Queried by doctor+date, by patient, by status and in aggregations. Embedding would make `patients` and `doctors` documents grow forever and rewrite the whole document on every change. |
| Medical records | **Referenced** | Sensitive, separately authorized, grows with every visit, own access rules and audit trail. |
| Documents | **Metadata in `medical_documents`, bytes in GridFS** | Files exceed the 16 MB BSON limit in principle and must not be served from public URLs; access is mediated by Express. |
| AI conversations | **`ai_conversations` + `ai_messages`** | Messages would be an unbounded embedded array. Splitting keeps the conversation document constant-size (`messageCount`) and capped at 200 messages by the API. |
| Notifications, audit logs | **Referenced** | Append-only streams that grow forever. |

### Document size and growth

- Maximum BSON document size is **16 MB**. Embedded arrays are bounded by validators: allergies ≤ 50, diagnoses ≤ 20, medications ≤ 30, availability ≤ 7. A maximal patient document is well under 20 KB.
- Referenced collections have no per-document growth, so updates touch one small document.
- **Update implications:** embedded arrays are changed with a single atomic `findOneAndUpdate`. The profile `PUT` replaces the whole allergy array, which is acceptable because the array is small. Referenced data needs a `$lookup` to read together; the cost is accepted and paid only on list screens, using indexed joins.
- **Query implications:** list endpoints use `$match` → `$sort` → `$skip/$limit` → `$lookup` so joins run only for the page being returned.

## Validation

JSON Schema validators (`database/validators/index.js`) on `users`, `patients`, `appointments`, `medical_records`, applied with `collMod`, `validationLevel: strict`, `validationAction: error`. They enforce required fields, BSON types, enumerations (`status`, `role`, `severity`, `consultationType`) and array bounds. A test inserts an appointment with `status: "banana"` directly through the driver and asserts error code 121.

## Indexes

| Index | Purpose |
|---|---|
| `users {email}` **unique** | One account per email; login lookup |
| `appointments {doctorId, startAt}` **compound** | Doctor schedule and date range queries (see explain evidence) |
| `appointments {patientId, startAt:-1}` | Patient history |
| `slot_reservations {doctorId, slotStart}` **unique** | Double-booking arbiter |
| `medical_records {patientId, visitAt:-1}` | Patient timeline |
| `patients {allergies.substance}` multikey | Allergy search |
| `doctors {specialty, name}`, text index | Directory filters and search |
| `notifications {recipientId, createdAt:-1}`, `ai_messages {conversationId, createdAt}`, `audit_logs {resourceId, createdAt}`, `medical_documents {patientId, uploadedAt}`, unique `patients.userId`, `doctors.userId`, `ai_conversations {patientId, sessionId}` | Feeds and ownership |

## Concurrency-safe booking

Slots are **fixed 30-minute blocks**, so the brief's recommended design applies: a separate `slot_reservations` collection with a **unique compound key** `(doctorId, slotStart)`.

- A booking runs in **one multi-document transaction**: insert the reservation, insert the appointment, insert the notification. Either all three commit or none do.
- Two requests racing for the same slot both try to insert the same unique key. MongoDB lets exactly one succeed; the other receives `E11000` (after any transient write-conflict retry), which the API maps to **HTTP 409**.
- Cancel and reschedule use transactions too: rescheduling inserts the new reservation, deletes the old one and updates the appointment atomically, so the old slot is only freed if the new one is secured.
- **Evidence:** `backend/tests/concurrency.test.js` fires 20 simultaneous requests for one slot and asserts exactly one `201`, nineteen `409`, one reservation and one appointment (`docs/evidence/tests/concurrency-test.log`).
- **Why not a unique index on appointments alone?** A cancelled appointment must not block the slot, and arbitrary overlapping intervals cannot be expressed as a unique key. Reservations exist only for live appointments, which is exactly the constraint.
- **Limitation:** this design assumes fixed slots. Variable-length appointments would need interval locking (for example a per-doctor lock document, or one reservation row per covered slot).

Transactions require a replica set; the local Docker setup runs a single-node replica set.

## Aggregations (`database/aggregations/index.js`)

| # | Pipeline | Operators |
|---|---|---|
| A | Appointment volume by doctor | `$group $sort $lookup $unwind $project` |
| B | Appointments joined to specialty | `$sort $limit $lookup $unwind $project` |
| C | Monthly trend by status | `$match $group $project $sort` |
| D | Top diagnoses | `$unwind $group $sort $limit $project` |
| E | Allergy prevalence | `$unwind $group $sort $limit $project` |
| F | Admin overview in one round trip | `$match $facet` (+ nested `$lookup $unwind $group`) |
| G | Patient age bands | `$project` (`$dateDiff`) `$bucket` |

Each is used by the API (`/api/analytics/overview`) and checked against independent `countDocuments` / `$size` control totals (`database/aggregations/run-all.js`, and a Jest test).

## Explain plan

`database/explain.js` drops the compound index, runs `explain("executionStats")` on a doctor's 60-day schedule, recreates the index and re-runs it. Results in `docs/evidence/explain/`:

| Run | Plan | keysExamined | docsExamined |
|---|---|---:|---:|
| Before | `SORT > COLLSCAN` | 0 | 2,200 |
| After | `FETCH > IXSCAN` | 39 | 39 |

The query examines 56× fewer documents and no longer needs an in-memory sort, because the index already returns `startAt` in order. Execution time shows 0 ms in both runs at this data size, so **examined documents, not milliseconds, are the evidence**; the gap in time grows with collection size.
