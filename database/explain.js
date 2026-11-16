'use strict';
// Before/after explain("executionStats") for the doctor-schedule query.
const fs = require('fs');
const path = require('path');
const { connect } = require('./lib');

const OUT = path.join(__dirname, '..', 'docs', 'evidence', 'explain');

function summarize(label, e) {
  const s = e.executionStats;
  const stages = [];
  (function walk(n) { if (!n) return; stages.push(n.stage); walk(n.inputStage); (n.inputStages || []).forEach(walk); })(e.queryPlanner.winningPlan);
  return { label, stages: stages.join(' > '), nReturned: s.nReturned, totalKeysExamined: s.totalKeysExamined, totalDocsExamined: s.totalDocsExamined, executionTimeMillis: s.executionTimeMillis };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { client, db } = await connect();
  try {
    const appts = db.collection('appointments');
    const doc = await appts.aggregate([{ $group: { _id: '$doctorId', c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 1 }]).next();
    const from = new Date(Date.now() - 30 * 864e5), to = new Date(Date.now() + 30 * 864e5);
    const filter = { doctorId: doc._id, startAt: { $gte: from, $lt: to } };
    const run = () => appts.find(filter).sort({ startAt: 1 }).explain('executionStats');

    await appts.dropIndex('doctor_schedule').catch(() => {});
    const before = await run();
    await appts.createIndex({ doctorId: 1, startAt: 1 }, { name: 'doctor_schedule' });
    const after = await run();

    fs.writeFileSync(path.join(OUT, 'before-no-index.json'), JSON.stringify(before, null, 2));
    fs.writeFileSync(path.join(OUT, 'after-index.json'), JSON.stringify(after, null, 2));
    const rows = [summarize('before (no index)', before), summarize('after (doctor_schedule)', after)];
    console.table(rows);
    const md = ['# Explain plan: doctor schedule query', '',
      'Query: `appointments.find({doctorId, startAt: {$gte, $lt}}).sort({startAt: 1})`', '',
      '| Run | Plan | nReturned | keysExamined | docsExamined | ms |', '|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.label} | ${r.stages} | ${r.nReturned} | ${r.totalKeysExamined} | ${r.totalDocsExamined} | ${r.executionTimeMillis} |`), ''].join('\n');
    fs.writeFileSync(path.join(OUT, 'summary.md'), md);
  } finally { await client.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
