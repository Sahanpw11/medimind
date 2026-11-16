# Explain plan: doctor schedule query

Query: `appointments.find({doctorId, startAt: {$gte, $lt}}).sort({startAt: 1})`

| Run | Plan | nReturned | keysExamined | docsExamined | ms |
|---|---|---|---|---|---|
| before (no index) | SORT > COLLSCAN | 39 | 0 | 2200 | 1 |
| after (doctor_schedule) | FETCH > IXSCAN | 39 | 39 | 39 | 0 |
