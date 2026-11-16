# MediMind

AI-powered healthcare intelligence and patient management platform: **an educational prototype using synthetic data only**. It is not medical advice and not clinically validated.

NIBM ADDSFT-M11 group project (*Use of NoSQL Databases for Data Science*). Stack: **MongoDB + Node.js/Express + Python/FastAPI + React (installable PWA)**.

## What it does

A patient registers, searches for a doctor, books a conflict-free 30-minute slot, views synthetic medical history, uploads a demonstration document, asks an educational assistant a question, and the activity shows up in an aggregation-backed admin dashboard. Doctors manage assigned appointments and write visit records; administrators manage the doctor directory and see aggregate analytics (never clinical notes).

## Run it (clone, install, go)

You need three things installed: **Node 20+**, **Python 3.9+** and **Docker Desktop** (open and running; it hosts MongoDB).

```bash
git clone <this repository's URL>
cd Medimind
npm install
npm run setup      # one time: starts MongoDB, prepares the AI service, loads the demo data (takes a few minutes)
npm start          # runs the API, the AI service and the web app together
```

Open **http://localhost:5173**. Demo logins (password `Demo@12345`): `patient@demo.test`, `doctor@demo.test`, `admin@demo.test`. You can also register a new patient.

There is nothing to configure: the settings are in the committed `.env` (local development values only; `.env.example` explains each one). Stop everything with `Ctrl+C`. To start fresh with clean demo data, run `npm run db:setup`.

**If something goes wrong:** `npm run setup` prints what is missing. The most common cause is Docker Desktop not running. Ports used: 5173 (web), 4000 (API), 8000 (AI), 27017 (MongoDB).

## Guides for the presentation and the viva

The full explanation (how it works, how it was built, the lecturer demo and the viva questions) is in [docs/guide/](docs/guide/00-START-HERE.md).

## Repository layout

```
frontend/      React + Vite + TypeScript PWA (see frontend/DESIGN.md)
backend/       Express API (src/app.js exports the app; server.js listens)
ai-service/    FastAPI service: retrieval assistant + no-show model (pure Python runtime)
database/      validators, indexes, seed, aggregations, explain, backup/restore scripts
docs/          architecture, schema rationale, OpenAPI, AI methodology, testing report, evidence
tests/e2e/     Playwright end-to-end tests
scripts/       setup and start helpers, icon generator
```

## Tests

```bash
npm test                          # 67 API and unit tests (needs MongoDB running; uses the medimind_test database)
npm run test:concurrency          # 20 simultaneous bookings for one slot
cd ai-service && .venv/bin/python -m pytest      # 15 AI tests
npx playwright install chromium && npm run test:e2e   # 40 E2E tests (builds and previews the frontend)
```

See [docs/testing-report.md](docs/testing-report.md) for results and security cases.

## MongoDB evidence

```bash
npm run db:explain                        # before/after explain("executionStats") -> docs/evidence/explain
node database/aggregations/run-all.js     # 7 pipelines with control-total checks
./database/backup.sh && ./database/restore.sh && node database/restore-verify.js
```

Design justification: [docs/schema-rationale.md](docs/schema-rationale.md). Diagrams: [docs/architecture.md](docs/architecture.md). API: [docs/openapi.yaml](docs/openapi.yaml). AI: [docs/ai-methodology.md](docs/ai-methodology.md).

## Accounts and roles

- **Patients** register themselves. The server always assigns the `patient` role; any role in the request is ignored (tested).
- **Doctors and administrators are not self-service.** An administrator adds doctors (name, specialty, weekly schedule, login) from the Doctors screen, and the seed script creates the demo admin and 20 doctors. This keeps control of who holds a clinical role with the admin, as the brief's role-integrity requirement asks.
- **New patients get a short welcome flow** on first sign-in (about you, allergies, emergency contact). It can be skipped, is shown once, and never appears for seeded demo accounts.

## Safety and privacy

Synthetic or fabricated data only. The assistant is retrieval-based and educational: it cites sources, refuses to diagnose or prescribe, escalates emergencies and always shows a disclaimer. No external LLM is used, and no identifiers are sent to the AI service. The service worker never caches API responses.

## AI assistance acknowledgement

Per brief §16: this project was built with substantial assistance from Claude (Anthropic), used as a coding assistant for scaffolding, implementation, tests and documentation. Every team member must review, run and be able to explain each component before submission. Replace this paragraph with your team's own statement of who did what.

## Contribution summary

_To be completed by the team: individual responsibilities and commit history._
