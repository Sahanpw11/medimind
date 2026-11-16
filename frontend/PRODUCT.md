# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React 18 + TypeScript + Vite, React Router, TanStack Query, Recharts, vite-plugin-pwa. Installable PWA. Runs locally alongside an Express API (`/api`) and a FastAPI service. Chosen by the user's brief (assignment spec: MongoDB + Node/Express + FastAPI + React).

## Users
- **Patient** (primary): registers, finds a doctor, books a 30-minute slot, views their own synthetic medical history, uploads a demonstration document, asks an educational AI assistant general health questions.
- **Doctor**: reviews assigned appointments, confirms/completes them, writes visit records for patients they have an appointment with.
- **Administrator**: manages the doctor directory and reads aggregate analytics; has no access to confidential clinical notes.
- **Assessors** (NIBM module ADDSFT-M11) evaluate a live demo and viva on a laptop/projector; the same product is also shown as an installed PWA on a phone.

## Product Purpose
MediMind is an educational healthcare platform prototype built for the NIBM "Use of NoSQL Databases for Data Science" assignment. It demonstrates a document-database-backed patient and appointment workflow with an internal AI/analytics service. Success is a convincing end-to-end demonstration: register, search a doctor, book a conflict-free slot, view history, upload a document, ask the assistant, see the activity reflected in an aggregation-backed dashboard.

## Positioning
The data and engineering are the point, not decoration: every screen is fed by real API/aggregation responses, and the interface makes access control, availability states, and AI limits visible rather than hidden.

## Operating Context
- Synthetic or fabricated data only; never real patient data. Demo accounts: `patient@demo.test`, `doctor@demo.test`, `admin@demo.test` (password in README).
- Slots are fixed 30-minute blocks in UTC; booking conflicts return 409 and must be explained in the UI.
- The AI assistant is retrieval-based and educational: it cites sources, always shows a disclaimer, refuses diagnosis/prescription requests, escalates emergencies, and falls back gracefully when the AI service is down.
- Medical data must never be cached by the service worker (API calls are network-only).

## Capabilities and Constraints
- Role-based access: patients see only their own data; doctors only patients they have appointments with; admins see aggregates only.
- Upload limits: PDF/PNG/JPEG/plain text, max 4 MB, private storage with controlled download.
- Admin dashboard needs at least three charts driven by `/api/analytics/overview`; no hardcoded data arrays in screens.
- Accessibility: labelled forms, meaningful validation errors, loading and empty states, mobile-responsive layouts, reduced-motion respected.
- MediMind must not be presented as clinically validated or as medical advice.

## Brand Commitments
- Name: **MediMind**. No existing logo, colours, or type: these are to be designed (user confirmed no brand assets).
- User decision, 2026-11-17 (supersedes the earlier Apple HIG feel): the app is **light theme only**, must look professional, and must use the **full available width** on desktop (no phone-shaped column). Typeface: Geist, self-hosted.

## Evidence on Hand
- Working API with 37 passing tests, FastAPI service with measured evaluation (assistant: hit@3 1.00 on a 35-item set; no-show model: simulated data, ROC-AUC ~0.64). No real users, testimonials, or clinical claims exist and none may be invented.

## Product Principles
1. Make the system's rules visible: availability, permissions, conflicts, and AI limits are shown in the interface, not buried.
2. Calm over clinical: reduce anxiety in a health context; plain language, no alarmist styling except for genuine emergency guidance.
3. Real data everywhere: no screen is populated by hardcoded arrays.
4. Honest about being a prototype: educational disclaimers are part of the design, not fine print.
5. Equally credible on a laptop projector and an installed phone app.

## Accessibility & Inclusion
Labelled form controls, visible focus, sufficient contrast in light and dark, 44 pt minimum touch targets, no colour-only status signalling, prefers-reduced-motion honoured.
