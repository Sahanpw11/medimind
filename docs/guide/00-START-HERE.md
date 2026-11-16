# Start here

This folder explains the MediMind project for the people who have to present it: you, your teammate, and anyone who asks questions in the viva.

| File | Read it when |
|---|---|
| `00-START-HERE.md` | First. What the project is and how to read the rest. |
| `01-CODE-TOUR.md` | You want to find where something lives in the code. |
| `02-HOW-IT-WORKS.md` | You need to explain the design: layers, data, booking, security, AI. |
| `03-HOW-IT-WAS-BUILT.md` | Someone asks how it was made, or what the AI assistance was. |
| `04-LECTURER-BRIEFING.md` | You are preparing the demo and the presentation. |
| `05-VIVA-PREP.md` | You are preparing for the individual questions. |

## The one-minute version

MediMind is an educational healthcare web app. Patients register, find a doctor, book a 30-minute slot, see their history, upload a synthetic document and ask a general health question. Doctors see their day and write visit records. Administrators manage the doctor list and see clinic analytics. All data is synthetic.

It has four parts that talk to each other:

```
Browser (React)  ->  Express API (Node.js)  ->  MongoDB
                              |
                              +-->  FastAPI AI service (Python)
```

The browser only talks to the Express API. Express is the only thing that touches the database, and it is the only thing that talks to the AI service. Each is covered in `02-HOW-IT-WORKS.md`.

## Before the viva: three things to be able to do

1. **Run it from a clean clone** (`npm install`, `npm run setup`, `npm start`). If it fails in front of an assessor, you lose marks you could have kept.
2. **Explain one request end to end.** Pick "book an appointment" and say which file handles each step. `02-HOW-IT-WORKS.md` has the walk-through.
3. **Say what you did yourself, and what was built with AI help.** The brief requires this, and `03-HOW-IT-WAS-BUILT.md` gives you the honest wording.

## The rule that matters most

The brief says every student must explain their own code and database decisions. You do not need to memorise every line. You do need to understand the **decisions**: why data is embedded or referenced, why booking uses a transaction, why the AI service is separate, what the no-show model does and does not prove. The viva guide is built around those decisions.
