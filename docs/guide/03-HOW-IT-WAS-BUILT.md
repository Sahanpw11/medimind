# How it was built

The brief requires you to acknowledge substantial AI assistance and to be able to explain every component. This page gives you the honest account and the wording to use.

## The honest statement

Use this wording in the report (Appendix or Introduction) and when asked:

> MediMind was built with substantial assistance from Claude, an AI coding assistant made by Anthropic. The AI generated much of the first-draft code, tests and documentation, and was guided by our team through the requirements, design decisions and reviews. Each team member has read, run and checked the components they are responsible for, and can explain them. The AI was used as a development tool; the design decisions, data model and evaluation choices are ours to defend, as set out in this report.

Adjust the last sentence to describe what you actually did. If you did not review a part, do not claim you can explain it. Read it first.

## What the AI did and what you did

Be specific in the report, because the contribution summary asks for individual responsibilities.

| Area | Built with AI help | Your job before submission |
|---|---|---|
| Requirements reading and plan | AI produced the first plan from the brief | Check it matches the brief, and decide the trade-offs |
| Database design and validators | AI drafted the schemas | Be able to justify each embed or reference (see `02-HOW-IT-WORKS.md`) |
| Booking transaction | AI drafted the transaction and tests | Explain the unique reservation key and the 409 path, and run the concurrency test yourself |
| API routes and access rules | AI drafted the routes | Walk through one role check and one access check |
| AI assistant and no-show model | AI wrote the code and the evaluation scripts | Explain the guardrails, the abstain threshold, and the limits of the no-show data |
| Frontend | AI generated the components and styling | Know the page structure and how a page gets its data |
| Tests | AI wrote most tests | Run them, read three, and know what each one proves |
| Documentation | AI drafted these guides | Read them, correct them, and make them your own explanation |

## How it was built, in order

This is the sequence to describe. It matches the brief's four-week plan.

1. **Plan and design.** The brief was split into requirements: actors and permissions, the eight collections, the API list and the security rules.
2. **Database first.** The 11 collections, JSON Schema validators, the indexes, and a deterministic seed (the same data every run, so results can be reproduced).
3. **Backend.** Authentication, then role-scoped routes, then the booking transaction, then uploads, the AI proxy and the analytics pipelines.
4. **AI service.** The corpus, the TF-IDF index, the guardrails, the no-show model, and the evaluation with its numbers saved to disk.
5. **Frontend.** Design system, then auth, then patient screens, doctor and admin screens, then the header, dashboards, chats and onboarding.
6. **Tests and evidence.** Unit, integration, concurrency, AI, end to end, plus explain plans and a backup restore check.
7. **Documentation and deployment preparation.** Architecture, OpenAPI spec, README, and the one-command local setup.

## Decisions you made or could defend

These are the choices an assessor can ask about. The answers are in `05-VIVA-PREP.md`.

- Embedded versus referenced data.
- A separate reservations collection for double-booking, rather than a unique index on appointments alone.
- A retrieval assistant with safety rules, instead of a generative language model that could invent medical advice.
- A simulated no-show model, with the limits stated.
- Doctors are added by an admin, not by sign-up.
- Synthetic data only, with the reserved `.test` email domain.
- The AI service is internal, protected by a shared secret.

## Things that went wrong and were fixed

Mention a few in the report. Assessors trust a project more when its problems are visible.

- **A booking screen bug:** after a conflict the screen jumped to another day. Found by a flaky test, reproduced with mocked data, fixed, and covered by a regression test.
- **Assistant answering off-topic questions:** "Explain quantum computing" matched an asthma passage on the word "explain". Fixed by treating generic instruction words as stop words. This change happened after the evaluation, so **the evaluation set is no longer fully held out**. Say so.
- **Dashboard charts using old colours:** the design was changed late and some charts still used removed colour names. Found in review and fixed.
- **Tests failing intermittently:** the login rate limit and random test data. The rate limit is now configurable and the test data is generated from the API.

## What is not finished or not verified

State these in the report's limitations. Do not hide them.

- No accessibility audit was run with an automated tool (Lighthouse or axe).
- The app was tested in Chromium only. Safari and the iOS install flow were not tested.
- Dark mode was removed on purpose; the app is light only.
- The rate limiter is per process, so it is a basic brake, not a global limit.
- Slots are fixed at 30 minutes, and all times are UTC.
- The no-show model is simulated.
- The assistant's evaluation set was written by the same team as the corpus.
