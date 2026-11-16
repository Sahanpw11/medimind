# Code tour

A map of the repository. Paths are relative to the project root.

## Top level

| Path | What is in it |
|---|---|
| `package.json` | npm workspaces and the commands: `npm run setup`, `npm start`, `npm test`, `npm run test:e2e` |
| `scripts/setup.js` | One-time setup: checks Docker and Python, starts MongoDB, creates the Python environment, loads demo data |
| `scripts/run-ai.js` | Starts the FastAPI service with the right Python (Windows and macOS) |
| `docker-compose.yml` | MongoDB 7 as a single-node replica set (transactions need one) |
| `.env` | Local development settings. Committed on purpose: nothing to configure after cloning. |
| `.env.example` | What each setting means |
| `playwright.config.ts` | Starts the three services and runs the end-to-end tests on desktop and phone sizes |
| `tests/e2e/` | End-to-end tests (browser) |
| `docs/` | Architecture, schema rationale, OpenAPI spec, AI methodology, testing report, evidence, this guide |

## Backend (`backend/`): Node.js, Express, MongoDB driver

| File | Role |
|---|---|
| `server.js` | Starts the Express app on port 4000 |
| `src/app.js` | Registers all routes and the error handler |
| `src/config.js` | Reads settings from the environment |
| `src/db.js` | One cached MongoDB connection, reused across requests |
| `src/errors.js` | HTTP error types (400, 401, 403, 404, 409) |
| `src/middleware/auth.js` | Checks the JWT cookie, sets `req.user`, and enforces roles (`requireRole`) |
| `src/middleware/validate.js` | Validates every request with zod; unknown fields are dropped |
| `src/services/booking.js` | **The slot rules and the booking transaction.** Read this file for the double-booking answer. |
| `src/services/access.js` | Patient and doctor access checks; writes the audit log |
| `src/services/files.js` | Checks an uploaded file's real content (signature bytes), not just its name |
| `src/routes/auth.js` | Register, login, refresh, logout, me. Rate-limited. |
| `src/routes/patients.js` | Patient profile read and update; doctor allergy search |
| `src/routes/doctors.js` | Directory, search, free slots for a day, admin create/update/delete |
| `src/routes/appointments.js` | Book, list, reschedule and cancel; admin delete of cancelled appointments |
| `src/routes/records.js` | Visit records: doctor creates, edits and deletes their own; patient history |
| `src/routes/documents.js` | Upload to GridFS, list, rename, delete, controlled download |
| `src/routes/ai.js` | Proxy to the AI service; saved chats; no-show risk for doctors |
| `src/routes/analytics.js` | Dashboards: admin overview and operations, doctor day, patient summary |
| `src/routes/notifications.js` | The notification bell |
| `tests/api.test.js` | Integration tests against a real MongoDB (role checks, booking, uploads, dashboards) |
| `tests/concurrency.test.js` | 20 simultaneous bookings for one slot |
| `tests/unit.test.js` | Pure rules tests (slot rules, file content check) with no database |

## Database (`database/`)

| File | Role |
|---|---|
| `lib.js` | Connection and deterministic ObjectId helper |
| `validators/index.js` | JSON Schema rules stored in MongoDB itself |
| `indexes.js` | All 15 indexes in one list |
| `collections.js` | Creates collections with validators and indexes |
| `seed.js` | Generates the synthetic data, seeded so every run is identical |
| `setup.js` | Runs the seed |
| `aggregations/index.js` | The aggregation pipelines (named functions the API and the checks both use) |
| `aggregations/run-all.js` | Runs them and compares totals with independent counts |
| `explain.js` | Before and after `explain("executionStats")` for the index evidence |
| `backup.sh`, `restore.sh`, `restore-verify.js` | Backup, restore into a separate database, and comparison |

## AI service (`ai-service/`): Python, FastAPI

| File | Role |
|---|---|
| `app/main.py` | The endpoints `/ai/chat` and `/predict/no-show`. Rejects requests without the shared secret. |
| `app/guardrails.py` | Safety rules run **before** retrieval: emergencies, diagnosis and prescription requests |
| `app/retrieval.py` | Finds the most relevant passages (TF-IDF cosine similarity) and decides when to say "I don't know" |
| `app/textproc.py` | Tokenising shared by the index builder and the runtime |
| `app/noshow.py` | Scores a no-show risk from stored coefficients |
| `corpus/passages.json` | The 35 synthetic health-education passages the assistant may quote |
| `model/index.json` | Pre-built TF-IDF index (generated) |
| `model/noshow_model.json` | Trained coefficients (generated) |
| `training/build_index.py` | Builds the index from the corpus |
| `training/train_noshow.py` | Simulates data, trains and evaluates the no-show model |
| `training/evaluate_assistant.py` | Runs the 35-question assistant evaluation |
| `tests/test_api.py` | 15 tests: schema, safety, secret checks, validation |
| `tests/eval_set.json` | The assistant's evaluation questions |

## Frontend (`frontend/`): React, Vite, TypeScript (installable PWA)

| File | Role |
|---|---|
| `index.html`, `vite.config.ts` | Entry page, build setup, PWA manifest and service worker |
| `src/main.tsx` | Starts the app and the data cache |
| `src/App.tsx` | All routes, and the guards that send people to the right home page |
| `src/index.css` | The whole design system: colours, spacing, components, layouts (in CSS layers) |
| `src/lib/api.ts` | The one place that calls the API; retries once after refreshing the session |
| `src/lib/auth.tsx` | Who is signed in, with their role |
| `src/components/Shell.tsx` | The header, navigation, mobile tab bar, offline notice |
| `src/components/HeaderBits.tsx` | Search, the New menu, notifications bell |
| `src/components/ui.tsx` | Shared pieces: cards, buttons, fields, banners, status chips, skeletons |
| `src/components/charts.tsx` | The bar chart used on every dashboard |
| `src/pages/Auth.tsx` | Sign in and register |
| `src/pages/patient/` | Home, Doctors, DoctorDetail (booking), Appointments, Records, Documents, Profile, Assistant, Welcome |
| `src/pages/doctor/` | DoctorDashboard, Schedule (appointments), VisitRecord |
| `src/pages/admin/` | Dashboard (operations and trends), DoctorAdmin |

## Where to look for common questions

- "How do you stop double booking?" `backend/src/services/booking.js`, then `database/indexes.js` (`uniq_doctor_slot`)
- "How do you stop a patient seeing another patient?" `backend/src/services/access.js` and the `assertPatientAccess` calls in the routes
- "How are roles enforced?" `backend/src/middleware/auth.js` (`requireRole`) and `backend/src/routes/auth.js` (role is always `patient` on register)
- "Where is the MongoDB schema?" `database/validators/index.js`
- "Where are the aggregations?" `database/aggregations/index.js` (11 pipelines)
- "How does the assistant avoid making things up?" `ai-service/app/retrieval.py` (abstains below a score) and `ai-service/app/main.py` (answers are copied passages)
