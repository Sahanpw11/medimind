# How it works

This is the explanation to give in the presentation and to answer design questions. Each section says what happens, where in the code, and why it was chosen.

## 1. The layers

```
Browser (React PWA)  --HTTP, same origin-->  Express API  --driver-->  MongoDB
                                                  |
                                                  +--HTTP + shared secret-->  FastAPI AI service
```

- **React** renders screens and calls the API. It never connects to MongoDB or the AI service.
- **Express** owns identity, roles, business rules and the public API. It is the only component that writes to the database.
- **MongoDB** stores everything, enforces document rules with JSON Schema, and does the aggregation work.
- **FastAPI** isolates the AI part: a retrieval assistant and a no-show scorer. It is internal (it refuses requests without the shared secret), so the browser cannot call it.

**Why separate them?** Each has one job, can be tested on its own, and the app still works if the AI service is down. When it is down, the assistant shows a clear fallback message with `degraded: true` and everything else keeps working. This is tested.

## 2. Authentication and roles

- Registration (`backend/src/routes/auth.js`) creates a user with the password hashed by bcrypt (cost 12). The role is **always** `patient`. A `role` sent by the client is ignored, and a test checks this.
- Login returns two signed tokens in **httpOnly cookies**: a 15-minute access token and a 7-day refresh token. JavaScript on the page cannot read them, which protects them from stolen-by-script attacks.
- Every protected route runs `authenticate` (`middleware/auth.js`), then `requireRole('doctor')` or similar. Roles come only from the signed token.
- Doctors and admins are created by an admin (or the seed script), not by sign-up. This is deliberate: see the question "why can't anyone become a doctor?" in `05-VIVA-PREP.md`.

## 3. Who can see what

Three checks, in code you can point to:

| Rule | Where |
|---|---|
| A patient can only read their own profile, records and documents | `services/access.js` (`assertPatientAccess`) |
| A doctor can read a patient only if they have an appointment together | `services/access.js` (`doctorHasRelationship`) |
| An admin never sees clinical notes or patient details; their analytics are aggregates only | `routes/analytics.js` (the operations pipeline has no patient fields, and a test checks the response) |

Every clinical read by a doctor writes a row to `audit_logs`.

## 4. Booking an appointment (the core NoSQL design)

Slots are fixed 30-minute blocks. The request goes through `POST /api/appointments`:

1. **Validate the input** (zod): a doctor id, a real date, a consultation type.
2. **Check the slot** (`services/booking.js`, `validateSlot`): in the future, within 180 days, on a 30-minute boundary, inside the doctor's working hours for that weekday.
3. **Start a transaction** and, inside it:
   - insert into `slot_reservations` with `(doctorId, slotStart)`. This collection has a **unique index** on that pair.
   - insert the appointment.
   - insert a notification for the patient and one for the doctor.
4. **Commit.** If another request already took the slot, the unique index rejects the insert with error code 11000. The code turns that into **HTTP 409** and the screen says "That time was just taken".

**Why a separate reservations collection?** A unique index on the appointments collection alone would block a slot forever once a booking is cancelled, and would not handle changes well. The reservation exists only while the appointment is live. Cancelling deletes the reservation, which frees the slot.

**Evidence:** `backend/tests/concurrency.test.js` sends 20 simultaneous bookings for one slot. The result is always exactly one `201` and nineteen `409`s, and the database holds exactly one reservation.

**Limit to state honestly:** this design assumes fixed slots. Variable-length appointments would need interval locking. See `docs/schema-rationale.md`.

## 5. Embedding versus referencing (know this cold)

| Data | Choice | Why |
|---|---|---|
| Patient demographics, allergies (max 50), emergency contact | **Embedded** in the patient document | Small, bounded, always read with the patient. One read. |
| Doctor weekly availability (max 7 days) | **Embedded** in the doctor document | Tiny, read every time a slot is shown. |
| Appointments | **Referenced** | Grow without limit per patient and per doctor. Queried by doctor and by date on their own. |
| Visit records | **Referenced** | Sensitive, grow with every visit, and have their own access rules. |
| Documents | Metadata referenced, **bytes in GridFS** | A file can be larger than a MongoDB document, and files must not be public URLs. |
| Chats | Conversation document plus a **separate messages collection** | Messages would be an endless array inside one document. |

The 16 MB document limit and the danger of unbounded arrays are the reasons. The validators cap the embedded arrays (allergies, diagnoses, medications in `database/validators/index.js`). The doctor availability cap of seven days is enforced by the API validation instead, because there is no doctor validator.

## 6. Queries, indexes and the explain evidence

- Every list endpoint filters, sorts and paginates (`page`, `limit` with a maximum of 100).
- The doctor's schedule query is the one the brief asks you to explain. Without an index, MongoDB reads all 2,200 appointments (`COLLSCAN`). With the compound index `(doctorId, startAt)` it reads only the 39 matching documents (`IXSCAN`). The numbers are in `docs/evidence/explain/summary.md`.
- Milliseconds were 1 ms both times at this size, so the **documents examined** is the evidence, not the time.

## 7. Aggregation pipelines

There are 11, in `database/aggregations/index.js`. The brief needs six. Examples to know:

- **Appointments per doctor:** `$group` by doctor, `$sort`, then `$lookup` to get the name.
- **Admin overview:** `$facet` runs several sub-pipelines (totals, status counts, specialty counts) in one round trip.
- **Patients by age band:** `$project` computes age with `$dateDiff`, then `$bucket`.
- **Calendar utilisation:** `$group` booked counts per doctor, divided in the API by the number of slots the doctor offers.

The API uses the same pipeline functions the checks use, and `run-all.js` compares the totals with independent counts. Totals match, which proves the pipelines are counting correctly.

## 8. The AI service, honestly

**Assistant (retrieval, not a language model).** Here is the path for a question:

1. `guardrails.py` checks for emergencies first. Those get the emergency message and no retrieval happens.
2. It checks for requests to diagnose, prescribe or dose. Those get a refusal.
3. `retrieval.py` scores the question against 35 passages using TF-IDF cosine similarity.
4. If the best score is below 0.18, it says it has no reliable information. This is the **abstain** path.
5. Otherwise it returns the best passage **copied word for word** with its id. It cannot invent content, because it only repeats passages that someone wrote and checked.

Measured on the 35-question set (`docs/evidence/ai/assistant-eval.json`): the right passage is first in 95% of answerable questions and in the top three in 100%. 90% of answerable questions were answered rather than declined. 100% of off-topic questions were declined, 100% of diagnosis and prescription requests were refused, and 100% of emergencies were escalated.

**No-show model.** A logistic regression trained on **simulated** data. Be explicit: there is no real no-show history, so the data comes from a rule we wrote. The model recovers that rule only moderately well (ROC-AUC 0.64, precision 0.22, recall 0.37). Accuracy looks fine (76%) only because most people attend. An always-attend guess scores 88%. The brief says never invent accuracy, and this report does not.

## 9. Frontend structure

- **Routing and guards** (`frontend/src/App.tsx`): each page is wrapped in `Protected` with the roles allowed. A patient who types `/admin` is redirected.
- **Data fetching** (TanStack Query): the page asks the API, shows a skeleton while loading, an error with a retry if it fails, and an empty state when there is nothing.
- **Dashboards** are fed by the analytics endpoints, not by hardcoded arrays. The brief forbids hardcoded data.
- **Offline and install:** a service worker caches the app shell. API responses are **never** cached (`vite.config.ts`, `NetworkOnly`), so synthetic medical data is never stored on the device.
- **Design:** a light clinical theme in `index.css`, built from named tokens and CSS layers. `frontend/DESIGN.md` records the system.

## 10. Testing layers

| Layer | Count | What it proves |
|---|---|---|
| Unit (Jest) | in `backend/tests/unit.test.js` | Slot rules, file content check, no database |
| Integration (Jest + supertest, real MongoDB) | in `backend/tests/api.test.js` | Every role rule, booking, uploads, dashboards, error handling |
| Concurrency (Jest) | 2 | Race conditions on booking |
| AI service (pytest) | 15 | Schema, safety, secret, validation |
| End to end (Playwright) | 40 | Whole journeys on desktop and phone sizes |
| Data checks | scripts | Aggregation totals, explain plans, backup restore |

Totals as of the last full run: 67 backend, 15 AI, 40 end to end.
