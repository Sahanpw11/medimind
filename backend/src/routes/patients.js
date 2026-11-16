'use strict';
const router = require('express').Router();
const { getDb } = require('../db');
const { validate, objectIdStr, toOid, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { assertPatientAccess, audit } = require('../services/access');
const { notFound } = require('../errors');

router.use(authenticate, requireRole('patient', 'doctor')); // admins use aggregate endpoints only

const listQuery = z.object({ allergy: z.string().trim().min(1).max(60), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) });

// Query C from the brief: patients with a given allergy ($elemMatch on the embedded array, served by the multikey index).
// A doctor only ever sees patients they have an appointment with.
router.get('/', requireRole('doctor'), validate({ query: listQuery }), async (req, res, next) => {
  try {
    const db = await getDb(), { allergy, page, limit } = req.query;
    const mine = await db.collection('appointments').distinct('patientId', { doctorId: toOid(req.user.profileId), status: { $ne: 'cancelled' } });
    const filter = { _id: { $in: mine }, allergies: { $elemMatch: { substance: { $regex: `^${allergy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } } };
    const [data, total] = await Promise.all([
      db.collection('patients').find(filter, { projection: { fullName: 1, dateOfBirth: 1, allergies: 1 } }).sort({ fullName: 1 }).skip((page - 1) * limit).limit(limit).toArray(),
      db.collection('patients').countDocuments(filter),
    ]);
    res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

const idParam = z.object({ id: objectIdStr });
const updateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date().refine((d) => d < new Date() && d > new Date('1900-01-01'), 'Invalid date of birth'),
  contact: z.object({ email: z.string().email().optional(), phone: z.string().max(30).optional() }),
  address: z.object({ city: z.string().max(80).optional(), country: z.string().max(80).optional() }),
  allergies: z.array(z.object({ substance: z.string().trim().min(1).max(80), severity: z.enum(['Mild', 'Moderate', 'Severe']) })).max(50),
  emergencyContact: z.object({ name: z.string().trim().min(1).max(120), relationship: z.string().trim().min(1).max(60), phone: z.string().max(30).optional() }),
  onboardingDone: z.literal(true), // can be completed, never reset by the client
}).partial().refine((o) => Object.keys(o).length > 0, 'No updatable fields supplied');

router.get('/:id', validate({ params: idParam }), async (req, res, next) => {
  try {
    const db = await getDb();
    await assertPatientAccess(db, req.user, req.params.id);
    const p = await db.collection('patients').findOne({ _id: toOid(req.params.id) });
    if (!p) throw notFound('Patient not found');
    if (req.user.role === 'doctor') await audit(db, req.user, 'read', 'patient', req.params.id);
    res.json(p);
  } catch (e) { next(e); }
});

router.put('/:id', requireRole('patient'), validate({ params: idParam, body: updateSchema }), async (req, res, next) => {
  try {
    const db = await getDb();
    await assertPatientAccess(db, req.user, req.params.id); // patients may only edit themselves
    const r = await db.collection('patients').findOneAndUpdate({ _id: toOid(req.params.id) }, { $set: { ...req.body, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (!r) throw notFound('Patient not found');
    res.json(r);
  } catch (e) { next(e); }
});

module.exports = router;
