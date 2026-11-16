'use strict';
const router = require('express').Router();
const { getDb } = require('../db');
const { toOid } = require('../middleware/validate');
const A = require('../../../database/aggregations');
const { validate, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/overview', requireRole('admin'), validate({ query: z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }) }), async (req, res, next) => {
  try {
    const db = await getDb(), now = Date.now();
    const from = req.query.from || new Date(now - 365 * 864e5), to = req.query.to || new Date(now + 180 * 864e5);
    const run = ([c, p]) => db.collection(c).aggregate(p).toArray();
    const [[ov], volume, trend, diagnoses, allergies, ages] = await Promise.all([
      run(A.adminOverview({ from, to })), run(A.volumeByDoctor()), run(A.monthlyTrend({ from, to })), run(A.topDiagnoses({ limit: 8 })), run(A.allergyPrevalence({ limit: 8 })), run(A.ageBands()),
    ]);
    const t = (ov.totals[0] || { total: 0, noShows: 0 });
    res.json({
      range: { from, to },
      totals: { appointments: t.total, noShows: t.noShows, noShowRate: t.total ? +(t.noShows / t.total).toFixed(4) : 0 },
      byStatus: ov.byStatus.map((r) => ({ status: r._id, count: r.count })),
      bySpecialty: ov.bySpecialty.map((r) => ({ specialty: r._id, count: r.count })),
      byConsultationType: ov.byConsultationType.map((r) => ({ type: r._id, count: r.count })),
      volumeByDoctor: volume.slice(0, 10), monthlyTrend: trend, topDiagnoses: diagnoses, allergyPrevalence: allergies,
      ageBands: ages.map((r) => ({ band: r._id === 'unknown' ? 'unknown' : `${r._id}+`, patients: r.patients })),
    });
  } catch (e) { next(e); }
});

// Doctor dashboard: strictly scoped to the signed-in doctor's own appointments.
router.get('/doctor', requireRole('doctor'), async (req, res, next) => {
  try {
    const db = await getDb(), now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = 864e5, dayEnd = new Date(dayStart.getTime() + day);
    const [r] = await db.collection('appointments').aggregate(A.doctorOverview({
      doctorId: toOid(req.user.profileId), now, dayStart, dayEnd, weekEnd: new Date(now.getTime() + 7 * day),
      fortnightEnd: new Date(dayStart.getTime() + 14 * day), from90: new Date(now.getTime() - 90 * day) })[1]).toArray();
    const byDay = new Map(r.daily.map((d) => [d._id, d.count]));
    const daily = Array.from({ length: 14 }, (_, i) => { const d = new Date(dayStart.getTime() + i * day).toISOString().slice(0, 10); return { date: d, count: byDay.get(d) || 0 }; });
    const out = Object.fromEntries(r.outcomes.map((o) => [o._id, o.count]));
    const finished = (out.completed || 0) + (out.no_show || 0);
    res.json({
      generatedAt: now, today: r.today, awaiting: r.awaiting[0]?.n || 0, upcoming7: r.upcoming7[0]?.n || 0,
      todayDone: r.today.filter((a) => a.status === 'completed').length,
      noShowRate: finished ? +((out.no_show || 0) / finished).toFixed(4) : 0, daily,
      outcomes: r.outcomes.map((o) => ({ status: o._id, count: o.count })), next: r.next[0] || null, attention: r.attention,
    });
  } catch (e) { next(e); }
});

// Patient dashboard: strictly the signed-in patient's own data.
router.get('/patient', requireRole('patient'), async (req, res, next) => {
  try {
    const db = await getDb(), now = new Date(), patientId = toOid(req.user.profileId);
    const from12 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const [[r], vitals, records, documents] = await Promise.all([
      db.collection('appointments').aggregate(A.patientOverview({ patientId, now, from12 })[1]).toArray(),
      db.collection('medical_records').aggregate(A.patientVitals({ patientId })[1]).toArray(),
      db.collection('medical_records').countDocuments({ patientId }),
      db.collection('medical_documents').countDocuments({ patientId }),
    ]);
    const byMonth = new Map(r.monthly.map((m) => [m._id, m.count]));
    const monthly = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(from12.getUTCFullYear(), from12.getUTCMonth() + i, 1)); const k = d.toISOString().slice(0, 7); return { month: k, count: byMonth.get(k) || 0 }; });
    res.json({ generatedAt: now, upcoming: r.upcoming, upcomingCount: r.upcomingCount[0]?.n || 0, completed12: r.completed12[0]?.n || 0, monthly, vitals, records, documents });
  } catch (e) { next(e); }
});

// Admin operations: clinic-wide, no patient details.
router.get('/operations', requireRole('admin'), async (req, res, next) => {
  try {
    const db = await getDb(), now = new Date(), day = 864e5;
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [[r], doctors] = await Promise.all([
      db.collection('appointments').aggregate(A.clinicOperations({ now, dayStart, dayEnd: new Date(dayStart.getTime() + day), weekEnd: new Date(now.getTime() + 7 * day), fortnightEnd: new Date(dayStart.getTime() + 14 * day), from90: new Date(now.getTime() - 90 * day) })[1]).toArray(),
      db.collection('doctors').find({}, { projection: { name: 1, specialty: 1, availability: 1 } }).toArray(),
    ]);
    const mins = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    const booked = new Map(r.perDoctor.map((x) => [String(x._id), x.booked]));
    const utilisation = doctors.map((d) => {
      let capacity = 0;
      for (let i = 0; i < 14; i++) { const dow = new Date(dayStart.getTime() + i * day).getUTCDay(); for (const a of d.availability) if (a.dayOfWeek === dow) capacity += Math.floor((mins(a.end) - mins(a.start)) / 30); }
      const b = booked.get(String(d._id)) || 0;
      return { name: d.name, specialty: d.specialty, booked: b, capacity, pct: capacity ? +(100 * b / capacity).toFixed(1) : 0 };
    }).sort((a, b) => b.pct - a.pct);
    const byDay = new Map(r.daily.map((d) => [d._id, d.count]));
    const daily = Array.from({ length: 14 }, (_, i) => { const d = new Date(dayStart.getTime() + i * day).toISOString().slice(0, 10); return { date: d, count: byDay.get(d) || 0 }; });
    const o = Object.fromEntries(r.outcomes90.map((x) => [x._id, x.count])), total90 = r.outcomes90.reduce((s, x) => s + x.count, 0);
    res.json({ generatedAt: now, today: r.today, unconfirmed7: r.unconfirmed7[0]?.n || 0, doctors: doctors.length, cancellationRate90: total90 ? +((o.cancelled || 0) / total90).toFixed(4) : 0, daily, utilisation });
  } catch (e) { next(e); }
});

module.exports = router;
