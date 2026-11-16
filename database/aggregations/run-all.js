'use strict';
// Runs every pipeline and checks key results against independent control totals.
const assert = require('assert');
const { connect } = require('../lib');
const A = require('./index');

(async () => {
  const { client, db } = await connect();
  try {
    const run = async ([coll, p]) => db.collection(coll).aggregate(p).toArray();
    const from = new Date('2000-01-01'), to = new Date('2100-01-01');

    const vol = await run(A.volumeByDoctor());
    const totalAppts = await db.collection('appointments').countDocuments();
    assert.strictEqual(vol.reduce((s, r) => s + r.totalAppointments, 0), totalAppts, 'A: volume sum != appointments count');

    const [ov] = await run(A.adminOverview({ from, to }));
    assert.strictEqual(ov.totals[0].total, totalAppts, 'F: facet total != count');
    assert.strictEqual(ov.byStatus.reduce((s, r) => s + r.count, 0), totalAppts, 'F: byStatus sum != count');
    assert.strictEqual(ov.bySpecialty.reduce((s, r) => s + r.count, 0), totalAppts, 'F: bySpecialty sum != count');

    const trend = await run(A.monthlyTrend({ from, to }));
    assert.strictEqual(trend.reduce((s, r) => s + r.count, 0), totalAppts, 'C: trend sum != count');

    const age = await run(A.ageBands());
    assert.strictEqual(age.reduce((s, r) => s + r.patients, 0), await db.collection('patients').countDocuments(), 'G: bands != patients');

    const dxTotal = (await db.collection('medical_records').aggregate([{ $group: { _id: null, n: { $sum: { $size: '$diagnoses' } } } }]).toArray())[0].n;
    const dxAll = await run(A.topDiagnoses({ limit: 1000 }));
    assert.strictEqual(dxAll.reduce((s, r) => s + r.count, 0), dxTotal, 'D: diagnosis sum != control');

    const alAll = await run(A.allergyPrevalence({ limit: 1000 }));
    const alControl = (await db.collection('patients').aggregate([{ $group: { _id: null, n: { $sum: { $size: '$allergies' } } } }]).toArray())[0].n;
    assert.strictEqual(alAll.reduce((s, r) => s + r.patients, 0), alControl, 'E: allergy sum != control');

    assert.strictEqual((await run(A.appointmentsWithSpecialty({ limit: 5 }))).length, 5);
    console.log('All 7 aggregations ran; control totals match (appointments=%d).', totalAppts);
  } finally { await client.close(); }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
