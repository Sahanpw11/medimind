# Architecture

## System

```mermaid
flowchart LR
  B["React PWA<br/>(browser)"] -- "HTTPS, httpOnly cookies" --> N["Node.js / Express API<br/>/api/*"]
  N -- "native driver, transactions" --> M[("MongoDB<br/>medimind_db + GridFS")]
  N -- "HTTP + X-Internal-Secret<br/>5 s timeout, safe fallback" --> F["FastAPI AI service<br/>/ai/chat, /predict/no-show"]
  B -. "never connects directly" .-> M
  B -. "never connects directly" .-> F
```

| Responsibility | Lives in | Why |
|---|---|---|
| Identity, JWT sessions, role checks, business rules, public API | Node.js | One enforcement point for authorization |
| Persistence, validation, aggregation, GridFS | MongoDB | The point of the module |
| Retrieval assistant, no-show scoring, guardrails | FastAPI | Isolated, independently testable and deployable; the rest of the app degrades gracefully when it is down |
| Rendering, routing, role-gated screens, PWA | React | Consumes only authorized Node APIs |

Node sends the AI service **only** the question text and an opaque conversation id. No patient identifiers or clinical records leave Node. The AI service logs the mode and score, never the question.

## Request flow: booking an appointment

```mermaid
sequenceDiagram
  participant P as Patient (React)
  participant A as Express
  participant D as MongoDB
  P->>A: POST /api/appointments {doctorId, startAt, ...}
  A->>A: verify JWT, role=patient, zod validation, slot rules
  A->>D: startTransaction
  A->>D: insert slot_reservations (unique doctorId+slotStart)
  alt slot already reserved
    D-->>A: E11000 duplicate key
    A-->>P: 409 "That time slot has just been taken"
  else free
    A->>D: insert appointments, insert notifications
    A->>D: commitTransaction
    A-->>P: 201 appointment
  end
```

## Collection relationships

```mermaid
erDiagram
  users ||--o| patients : "userId"
  users ||--o| doctors : "userId"
  patients ||--o{ appointments : "patientId"
  doctors ||--o{ appointments : "doctorId"
  appointments ||--o| slot_reservations : "appointmentId"
  patients ||--o{ medical_records : "patientId"
  doctors ||--o{ medical_records : "doctorId"
  patients ||--o{ medical_documents : "patientId"
  medical_documents ||--|| "documents.files (GridFS)" : "storageKey"
  patients ||--o{ ai_conversations : "patientId"
  ai_conversations ||--o{ ai_messages : "conversationId"
  users ||--o{ notifications : "recipientId"
  users ||--o{ audit_logs : "actorId"
```

## Running locally

```
npm run setup   one time: MongoDB (Docker), Python virtual environment, demo data
npm start       API :4000, AI service :8000, web app :5173 (the browser only talks to :5173)
```

Configuration lives in `.env` (local development values only; see `.env.example` for what each variable does).
