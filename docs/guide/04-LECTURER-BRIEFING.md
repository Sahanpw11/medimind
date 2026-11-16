# Lecturer briefing and demo

## How to present, in one paragraph

Say what the app does for a patient, a doctor and an administrator. Then show the **end-to-end demonstration** the brief asks for, in the order it lists. Then open the database and the evidence, because the module is about NoSQL and the marks are mostly for database engineering. Finish with the honest limitations. A project that names its own limits is more credible than one that claims everything works perfectly.

## Before the presentation

1. **Clone the repository into a clean folder and run it.** Do this the day before and again on the morning. Commands: `npm install`, `npm run setup`, `npm start`.
2. **Check Docker is running** and that http://localhost:5173 opens.
3. **Reset the demo data** with `npm run db:setup` so your test runs have not filled the calendar.
4. **Open these tabs in advance:**
   - the app at http://localhost:5173
   - `docs/evidence/explain/summary.md`
   - `docs/evidence/ai/assistant-eval.json`
   - `docs/evidence/backup/restore-verification.md`
   - `docs/evidence/tests/` (the test logs)
   - `docs/openapi.yaml`, or the same content rendered in a viewer
5. **Have a backup plan.** If the live demo fails, show the screenshots in `docs/evidence/screenshots/`. Say what went wrong and show the log.
6. **Know the demo accounts.** Password for all three is `Demo@12345`: `patient@demo.test`, `doctor@demo.test`, `admin@demo.test`.

## The demo, in the brief's order (about 10 minutes)

| Step | Do this | Say this | Show this in the code or evidence |
|---|---|---|---|
| 1. Register | Create a new patient account. Go through the welcome steps. | "Patients register themselves. The role is always set by the server." | `routes/auth.js` |
| 2. Search | Go to Doctors, search, filter by specialty. | "Search and filter are indexed queries, paginated on the server." | `routes/doctors.js`, `database/indexes.js` |
| 3. Book | Pick a day and a free slot. Book it. | "Each slot is reserved with a unique key inside a transaction, so double booking is rejected at database level." | `services/booking.js`, the concurrency test log |
| 4. Conflict | Show a taken slot, or describe it. | "If someone else takes it first, the database rejects the second write and the user gets a 409." | `docs/evidence/tests/concurrency-test.log` (1 × 201, 19 × 409) |
| 5. History | Open Visits and Records. | "Records are referenced, not embedded, because they grow and are sensitive. Only the owner or the doctor who saw them can read them." | `services/access.js` |
| 6. Upload | Upload a synthetic text file. Download it. | "Files are stored in GridFS. The server checks the real content, not just the extension, and downloads go through an ownership check." | `routes/documents.js`, `services/files.js` |
| 7. Assistant | Ask "What are vital signs?", then "Do I have diabetes?" | "The assistant only repeats approved passages. It refuses diagnosis, and it escalates emergencies. Here is its measured accuracy." | `ai-service/app/guardrails.py`, `docs/evidence/ai/assistant-eval.json` |
| 8. Dashboard | Log in as the admin. Show the operations section, then the trends. | "These are aggregation pipelines. The admin sees totals and never patient details." | `database/aggregations/index.js`, `routes/analytics.js` |
| 9. Role check | Log in as a patient and try `/admin`. Or call an admin endpoint with a patient token. | "The access rule is enforced on the server. The screen hiding a page is not the security." | `middleware/auth.js`, the API tests |
| 10. Doctor view | Log in as the doctor. Show the dashboard, then Manage on an appointment. | "Doctors only see their own patients and their own day." | `routes/analytics.js` (`/doctor`) |

## Show the database (about 5 minutes)

The brief marks database engineering most heavily. Use `mongosh` or MongoDB Compass against the local database (`medimind_db`, port 27017).

- **Collections:** list the 11 collections. Point out that patients embed their allergies, and appointments are separate.
- **Validators:** `db.getCollectionInfos({name: "appointments"})` shows the rule that rejects a bad status even if the API is bypassed. Show the rejection with `status: "banana"` if you can.
- **Indexes:** `db.appointments.getIndexes()` and `db.slot_reservations.getIndexes()`. Point out the unique key.
- **Explain plan:** open `docs/evidence/explain/summary.md`. Read the before and after rows aloud: 2,200 documents examined down to 39.
- **Aggregation:** run one pipeline in the shell, for example the appointments grouped by doctor. Explain each stage.

## Evidence the lecturer may ask for

| Ask | Show |
|---|---|
| Tests | `docs/evidence/tests/api-tests.log` and `ai-service-pytest.log`, and the testing report |
| Concurrency | `docs/evidence/tests/concurrency-test.log` |
| Aggregations match counts | `docs/evidence/tests/aggregation-control-totals.log` |
| Backup and restore | `docs/evidence/backup/restore-verification.md` (PASS, with counts and a sample check) |
| AI evaluation | `docs/evidence/ai/assistant-eval.json` and `noshow-eval.json` |
| Security cases | `docs/testing-report.md`, the security table |
| Architecture | `docs/architecture.md` (diagrams) |
| Schema reasoning | `docs/schema-rationale.md` |

## Limitations to state before they ask

Say these yourself. It shows you understand the project.

- The no-show model is trained on simulated data. Its accuracy is not clinical evidence.
- The assistant uses a fixed set of 35 passages and keyword safety rules. It can miss a paraphrased emergency.
- Slots are fixed at 30 minutes. Variable appointment lengths would need a different locking design.
- The rate limit works per server process.
- Accessibility was not audited with an automated tool, and only Chromium was tested.
- The app is for demonstration only. It is not clinically validated and must not be used for real patients.

## Handling questions in the presentation

- If you do not know, say so and say how you would find out. Then move on.
- If something breaks, stay calm, say what you think the cause is, and show the evidence file instead.
- Do not claim a feature the code does not have. The assessors will check.
