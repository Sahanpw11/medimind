'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const config = require('../config');
const { getDb, getClient } = require('../db');
const { validate, objectIdStr, toOid, pagination, pageMeta, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { bad, notFound, conflict } = require('../errors');

router.use(authenticate);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = { name: { name: 1 }, specialty: { specialty: 1, name: 1 } };

router.get('/', validate({ query: pagination.extend({ q: z.string().trim().max(60).optional(), specialty: z.string().trim().max(60).optional(), sort: z.enum(['name', 'specialty']).default('name') }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const { page, limit, q, specialty, sort } = req.query;
    const filter = {};
    if (specialty) filter.specialty = specialty;
    if (q) filter.$or = [{ name: { $regex: esc(q), $options: 'i' } }, { specialty: { $regex: esc(q), $options: 'i' } }];
    const [data, total] = await Promise.all([
      db.collection('doctors').find(filter, { projection: { userId: 0 } }).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).toArray(),
      db.collection('doctors').countDocuments(filter),
    ]);
    res.json({ data, ...pageMeta(page, limit, total) });
  } catch (e) { next(e); }
});

router.get('/specialties', async (_req, res, next) => {
  try { res.json({ data: (await (await getDb()).collection('doctors').distinct('specialty')).sort() }); } catch (e) { next(e); }
});

router.get('/:id/slots', validate({ params: z.object({ id: objectIdStr }), query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD') }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const doc = await db.collection('doctors').findOne({ _id: toOid(req.params.id) });
    if (!doc) throw notFound('Doctor not found');
    const day = new Date(req.query.date + 'T00:00:00Z');
    if (isNaN(day)) throw bad('Invalid date');
    const win = doc.availability.find((a) => a.dayOfWeek === day.getUTCDay());
    if (!win) return res.json({ date: req.query.date, slots: [] });
    const m = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
    const taken = new Set((await db.collection('slot_reservations').find({ doctorId: doc._id, slotStart: { $gte: day, $lt: new Date(day.getTime() + 864e5) } }, { projection: { slotStart: 1 } }).toArray()).map((r) => r.slotStart.getTime()));
    const now = Date.now(), slots = [];
    for (let t = m(win.start); t + config.slotMinutes <= m(win.end); t += config.slotMinutes) {
      const startAt = new Date(day.getTime() + t * 60000);
      slots.push({ startAt, endAt: new Date(startAt.getTime() + config.slotMinutes * 60000), status: startAt.getTime() <= now ? 'past' : taken.has(startAt.getTime()) ? 'taken' : 'available' });
    }
    res.json({ date: req.query.date, slots });
  } catch (e) { next(e); }
});

router.get('/:id', validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const d = await (await getDb()).collection('doctors').findOne({ _id: toOid(req.params.id) }, { projection: { userId: 0 } });
    if (!d) throw notFound('Doctor not found');
    res.json(d);
  } catch (e) { next(e); }
});

// ---- Admin-only directory management ----
const availability = z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).max(7);
const createSchema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(8).max(128), name: z.string().trim().min(2).max(120), specialty: z.string().trim().min(2).max(60), availability });
const updateSchema = z.object({ name: z.string().trim().min(2).max(120), specialty: z.string().trim().min(2).max(60), availability }).partial().refine((o) => Object.keys(o).length, 'No fields supplied');

router.post('/', requireRole('admin'), validate({ body: createSchema }), async (req, res, next) => {
  try {
    const db = await getDb(), now = new Date();
    const user = { _id: new ObjectId(), email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), role: 'doctor', status: 'active', createdAt: now };
    const doc = { _id: new ObjectId(), userId: user._id, name: req.body.name, specialty: req.body.specialty, clinic: {}, consultationTypes: ['online', 'in_person'], availability: req.body.availability, createdAt: now };
    const session = (await getClient()).startSession();
    try {
      await session.withTransaction(async () => { await db.collection('users').insertOne(user, { session }); await db.collection('doctors').insertOne(doc, { session }); });
    } catch (e) { if (e.code === 11000) throw conflict('Email already in use'); throw e; } finally { await session.endSession(); }
    res.status(201).json({ ...doc, userId: undefined });
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('admin'), validate({ params: z.object({ id: objectIdStr }), body: updateSchema }), async (req, res, next) => {
  try {
    const r = await (await getDb()).collection('doctors').findOneAndUpdate({ _id: toOid(req.params.id) }, { $set: req.body }, { returnDocument: 'after', projection: { userId: 0 } });
    if (!r) throw notFound('Doctor not found');
    res.json(r);
  } catch (e) { next(e); }
});

// A doctor with any appointment history cannot be deleted: appointments and records reference them.
router.delete('/:id', requireRole('admin'), validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const db = await getDb(), doc = await db.collection('doctors').findOne({ _id: toOid(req.params.id) });
    if (!doc) throw notFound('Doctor not found');
    if (await db.collection('appointments').findOne({ doctorId: doc._id }, { projection: { _id: 1 } })) throw conflict('This doctor has appointment history and cannot be deleted. Remove their availability instead.');
    const session = (await getClient()).startSession();
    try {
      await session.withTransaction(async () => { await db.collection('doctors').deleteOne({ _id: doc._id }, { session }); await db.collection('users').deleteOne({ _id: doc.userId }, { session }); });
    } finally { await session.endSession(); }
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
