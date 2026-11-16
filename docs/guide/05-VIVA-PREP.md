# Viva preparation

The viva is individual. Each person answers questions about their own code and their own decisions. These questions come from the brief's suggested list and from the places an assessor usually looks. Each answer names the file to point to.

**How to use this page:** do not memorise the answers word for word. For each question, open the named file, find the thing being described, and explain it in your own words. If you cannot find it in the code, that is the gap to fix before the viva.

## Part A: the database (most marks)

**Q1. Why MongoDB for this workload?**
Healthcare data is nested and varies: a patient has allergies, a doctor has a weekly schedule, a visit has diagnoses and vitals. A document model stores that naturally. Growing, independent records (appointments, visits, notifications) are kept in their own collections so no document grows without limit. Point to `database/validators/index.js` and `docs/schema-rationale.md`.

**Q2. What do you embed and what do you reference, and why?**
Embed what is small, bounded and always read with its parent: patient demographics, allergies (at most 50), emergency contact, doctor availability. Reference what grows, is sensitive or is queried on its own: appointments, visit records, notifications, documents' bytes. Be ready to say what happens to an embedded array that grows with no limit (the document approaches the 16 MB limit and every update rewrites more data). The validators are the answer.

**Q3. Why are chat messages in their own collection?**
A conversation's messages would be one array inside one document. That array would grow for ever, and each new message would rewrite the whole thing. The conversation document keeps only a count and the title; the messages live in `ai_messages`. See `backend/src/routes/ai.js`.

**Q4. How do you stop double booking?**
Every booking writes a row to `slot_reservations` with a unique key on `(doctorId, slotStart)`. The unique index is what stops a second booking, not the application code, so it holds even with simultaneous requests. The insert, the appointment and the notifications happen in one transaction. A second request gets error 11000, which the API turns into a 409. Point to `backend/src/services/booking.js` and `database/indexes.js`. Show `docs/evidence/tests/concurrency-test.log`.

**Q5. Why a separate reservations collection? Why not just a unique index on appointments?**
A unique index on appointments would block a slot even after the appointment was cancelled, unless we added a partial index. The reservation exists only while the appointment is live, so cancelling frees the slot by deleting one row. It also handles rescheduling as one transaction: claim the new slot, release the old one.

**Q6. How do $lookup and $unwind work?**
`$lookup` joins a document with another collection on a field (like a SQL left join) and puts the matches in an array field. `$unwind` turns that array into one output document per element, so you can read fields from it. Example: the appointments-with-specialty pipeline in `database/aggregations/index.js`. Note `$unwind` drops documents with an empty array unless you set `preserveNullAndEmptyArrays`.

**Q7. How does $facet help analytics?**
`$facet` runs several pipelines over the same input in one database call and returns each result in a named field. The admin overview gets totals, status counts and specialty counts together, so the page does one round trip instead of three. See `adminOverview` in the aggregations file.

**Q8. Which queries benefit from your compound index, and why?**
The doctor's schedule: "this doctor's appointments between two dates, in order". The index `(doctorId, startAt)` matches the equality on doctorId followed by the range and sort on startAt, so MongoDB reads only the matching entries in order. Show `docs/evidence/explain/summary.md`: 2,200 documents examined with no index, 39 with it.

**Q9. What do examined keys and documents and execution time tell you?**
Keys examined is how many index entries were read. Documents examined is how many full documents were loaded from disk. A good query examines about as many documents as it returns. Execution time depends on data size and cache, so at 2,200 documents it is 1 ms either way; the document count is the honest measure. The `winningPlan` shows `COLLSCAN` (scan everything) or `IXSCAN` (use an index).

**Q10. How do you check the aggregation results are correct?**
`database/aggregations/run-all.js` compares each pipeline's total with an independent count made with a simple `countDocuments` or `$size`. For example, the appointments per doctor must add up to the total appointments. It prints "control totals match". Show `docs/evidence/tests/aggregation-control-totals.log`.

**Q11. What are the JSON Schema validators for?**
They stop bad data at the database, even if the API has a bug or someone connects directly. The `appointments` validator rejects a status that is not in the allowed list. Demonstrate with `db.appointments.insertOne({... status: "banana"})` if asked.

**Q12. What is a transaction and when did you use one?**
A transaction makes several writes succeed or fail together. Booking uses one: reservation, appointment and notifications, all or nothing. It needs a replica set, which is why `docker-compose.yml` starts MongoDB as one. Be ready to say what would go wrong without it: a reservation without an appointment, or an appointment without a reservation.

**Q13. How do you back up and restore? How do you know it worked?**
`database/backup.sh` makes a compressed archive with `mongodump`. `database/restore.sh` restores it into a separate database so the original is never overwritten. `database/restore-verify.js` compares document counts, deep-compares a random sample of documents, checks indexes and checks the validators. The result is in `docs/evidence/backup/restore-verification.md`: PASS.

## Part B: the backend (Node.js and Express)

**Q14. How does a request get from the browser to the database?**
The browser calls `/api/...` on the same origin. `app.js` routes it to a route file. Middleware runs first: `authenticate` checks the cookie, `validate` checks the body with zod, `requireRole` checks the role. The route calls `getDb()` and runs a query or a service function. Errors go to one handler that returns a clean JSON message.

**Q15. How do you know who the user is?**
A login sets two httpOnly cookies, a 15-minute access token and a 7-day refresh token, both signed with secrets from the environment. `middleware/auth.js` verifies the signature on every request. The browser sends the cookie automatically and JavaScript cannot read it. An expired token gets 401, and the client refreshes it once.

**Q16. How do you store passwords?**
bcrypt with a cost factor of 12. The database stores only the hash. The login compares with a dummy hash when the account does not exist, so the response takes about the same time (no account enumeration).

**Q17. How do you stop a patient seeing another patient's record?**
Two checks, not one: the route calls `assertPatientAccess`, which compares the signed-in patient's id with the requested patient id, and the query itself filters by patient. Tests call another patient's record and expect 403. Explain that the check is on the server, not in the screen.

**Q18. Why can't a patient make themselves a doctor?**
Registration always sets the role to patient, and any `role` field in the request is dropped by validation. Doctors are created only by an admin. This is the brief's rule that client-supplied roles are never authoritative. A test sends `role: "admin"` during registration and checks the account is a patient.

**Q19. What is validation and why is it on the server too?**
Validation checks that input has the right type, length and values before it reaches the database. The browser checks too, for speed, but a user or an attacker can skip the browser. The server's zod schemas are the real gate. Unknown fields are removed, so a client cannot slip in fields it should not set.

**Q20. How do you prevent injection attacks?**
Values go into queries as typed values, never as strings built into the query. Search text is escaped before it becomes a regular expression. An object sent where a string was expected (like `q[$ne]=x`) is rejected with 400. A test checks the operator case.

**Q21. How does pagination work and what are its limits?**
Every list takes `page` and `limit`. The default limit is 20 and the maximum is 100, enforced by zod. The response includes `total` and `pages`. Offset pagination is simple but gets slower for very deep pages. Cursor pagination would be better for large data; the brief allows either.

**Q22. How do file uploads stay safe?**
There is a 4 MB limit, enforced by multer before the body is read. The server checks the real content by its first bytes (PDF, PNG, JPEG, text) and rejects executables even if they are renamed to `.pdf`. Files go to GridFS, not a public folder. Downloads require the owner check and are sent with `Cache-Control: private, no-store`. `services/files.js` and its unit tests show this.

**Q23. How do errors and failures get handled?**
Known errors have an HTTP status and a message (400, 401, 403, 404, 409). Unknown errors return a generic 500 with no stack trace, which a test checks. The AI call has a 5-second timeout and falls back to a safe message if it fails.

**Q24. What would you change for production?**
Honest answers: a real secrets manager instead of `.env`, HTTPS termination in front of the app, a shared rate limiter (for example Redis) instead of per-process, a proper logging service that does not record personal data, and a managed MongoDB with backups enabled.

## Part C: the AI service (Python and FastAPI)

**Q25. Why is the AI service separate from Node?**
Separate responsibilities and separate testing. The AI code can be developed and tested in Python on its own. If it fails, the rest of the app still works. It is internal, so the browser cannot call it.

**Q26. How does the assistant avoid making things up?**
It does not generate text. It finds the most relevant approved passage and returns it word for word, with the passage id. If the best match is below the threshold (0.18), it says it does not know. Safety rules run before retrieval, so emergencies and diagnosis requests never reach the passages.

**Q27. How did you evaluate it, and what are the numbers?**
35 test questions, written by the team: 20 answerable with a known right passage, 5 off-topic, 6 diagnosis or prescription requests, and 4 emergencies. Results in `docs/evidence/ai/assistant-eval.json`: right passage first in 95% of answerable questions, in the top three in 100%, answered in 90%. All off-topic questions declined, all diagnosis requests refused, all emergencies escalated.

**Q28. What are the limits of that evaluation?**
Honest answers: the question set is small and written by the same people who wrote the passages. One keyword fix was made after looking at the results, so the set is not fully held out. A paraphrased emergency could be missed because the emergency rules are keywords.

**Q29. What does the no-show model do, and what does it prove?**
It is a logistic regression: a weighted sum of a few features (lead time, past missed visits, consultation type) turned into a probability. It is trained on **simulated** data because there is no real no-show history. It proves the pipeline works end to end: data, training, saved coefficients, a served prediction, a fallback when the service is down. It does not prove real-world prediction. Its test ROC-AUC is 0.64, which is only modestly better than chance.

**Q30. Why did you show accuracy as misleading?**
In the simulated training data about 12% of appointments are no-shows, so a model that always predicts "attends" scores about 88% accuracy and tells you nothing. (In the seeded demo data the no-show rate is about 7%, so the same effect applies there.) Precision (0.22), recall (0.37) and F1 (0.28) are the honest measures, and the file shows the confusion matrix. Say this before they ask.

**Q31. What happens if the AI service is down?**
The Node API catches the failed call, returns a fallback message with `degraded: true`, and the screen says the assistant is unavailable. The rest of the app is unaffected. This is covered by a test that points the service URL at a closed port.

**Q32. How does the Node service protect the AI service?**
Every call carries a shared secret in a header, compared in constant time. The AI service rejects calls without it. In production it refuses to start without the secret. Node sends only the question and an opaque session id, never a patient id or a clinical record.

## Part D: the frontend (React)

**Q33. How does a page get its data?**
TanStack Query calls the API, caches the result, and gives the component loading, error and data states. The page shows a skeleton while loading, a message with a retry on error, and an empty state if there is nothing. The data always comes from the API. The dashboards are never hardcoded.

**Q34. How is the app protected on the front end?**
Route guards in `App.tsx` check the role and redirect people to their home page. This is for user experience only. The real protection is the server check, which the guards cannot replace.

**Q35. What is a PWA and what does yours do?**
A web app that can be installed and works like an app. It has a manifest (name, icons, standalone display) and a service worker that caches the app shell. Medical data is never cached: API requests are network-only, which a Playwright test checks. Offline, the shell opens and a message explains the data needs a connection.

**Q36. How do you meet the accessibility requirements?**
Labels on every form field, error messages linked to their fields, focus styles, buttons with a minimum target size, status shown with an icon and text as well as colour, and reduced motion respected. Be honest: no automated accessibility audit was run, so say that rather than claim full compliance.

**Q37. Why are the charts built from API data?**
The brief says dashboards must be computed from aggregation API responses, and screens with hardcoded arrays do not meet the integration requirement. The chart component takes data from the analytics endpoint and draws it. Show the network request in the browser's developer tools if asked.

## Part E: testing

**Q38. What tests do you have and what does each prove?**
Unit tests for the slot rules and the file check, with no database. Integration tests against a real MongoDB for every role rule, booking, uploads, dashboards and errors. A concurrency test for 20 simultaneous bookings. AI service tests for the response shape, the safety rules and the secret. End-to-end tests in a real browser on desktop and phone sizes for whole journeys. Give the counts: 67 backend, 15 AI, 40 end to end.

**Q39. What is a regression test and did you write one?**
A test that fails before a bug is fixed and passes after, so the bug cannot come back unnoticed. The booking-conflict bug has one: `tests/e2e/conflict-last-slot.spec.ts`. It mocks the slot data so the failure is deterministic, and it failed before the fix.

**Q40. How do you know the tests are reliable?**
The full end-to-end suite was run repeatedly and passed each time after the fixes. Be ready to say what was flaky, why, and what fixed it: test data depleting a shared calendar, and the login rate limit. Those were test-environment problems, and the fixes are in the test setup.

## Part F: the project and the process

**Q41. What did you build yourself and what was AI-assisted?**
Answer from `03-HOW-IT-WAS-BUILT.md`. Be specific about the parts you reviewed and can explain, and do not claim parts you cannot. This is the question where honesty matters most.

**Q42. What would you do differently?**
A real answer shows reflection. Options that are true for this project: use a shared rate limiter from the start, write the evaluation set before writing the passages, keep the design documents in step with the code, and split the frontend styling into components sooner.

**Q43. What is the weakest part of the project?**
Good answers: the no-show model (simulated data), the assistant's keyword safety (can miss paraphrases), the fixed 30-minute slots, and the untested accessibility audit. Name one and say how you would fix it.

**Q44. How would this be deployed for real?**
A managed MongoDB (such as Atlas) with backups, the API and AI service running as separate services, HTTPS, secrets in a secrets manager, and the monitoring and logging discussed in Q24. Say clearly that this is not done here and this project is a demonstration.

## Last-minute checklist

- [ ] I can run the app from a clean clone.
- [ ] I can walk through booking, from the button to the transaction, pointing at files.
- [ ] I can explain one embed decision and one reference decision.
- [ ] I can explain the unique index and what error 11000 means.
- [ ] I can read the explain summary aloud.
- [ ] I can say what the assistant does and does not do, with its numbers.
- [ ] I can state the no-show model's limits before being asked.
- [ ] I can say which parts I wrote or reviewed myself.
- [ ] I know where the limitations are listed.
