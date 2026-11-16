'use strict';
const router = require('express').Router();
const { getDb } = require('../db');
const { validate, objectIdStr, toOid, pagination, pageMeta, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { assertPatientAccess, doctorHasRelationship, audit } = require('../services/access');
const { forbidden, bad, notFound } = require('../errors');

router.use(authenticate, requireRole('patient', 'doctor')); // no blanket admin access to clinical notes

const createSchema = z.object({
  patientId: objectIdStr, appointmentId: objectIdStr.optional(),
  visitAt: z.coerce.date().refine((d) => d <= new Date(Date.now() + 864e5), 'visitAt cannot be in the future'),
  diagnoses: z.array(z.object({ code: z.string().trim().min(1).max(12), description: z.string().trim().min(1).max(200) })).min(1).max(20),
  vitals: z.object({ systolicBP: z.number().min(40).max(300), diastolicBP: z.number().min(20).max(200), heartRate: z.number().min(20).max(250) }).partial().optional(),
  medications: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  notes: z.string().trim().max(4000).optional(),
  followUpRequired: z.boolean().default(false),
});

router.post('/', requireRole('doctor'), validate({ body: createSchema }), async (req, res, next) => {
  try {
    const db = await getDb();
    if (!(await doctorHasRelationship(db, req.user.profileId, req.body.patientId))) throw forbidden('You have no appointment with this patient');
    const b = req.body;
    const rec = { patientId: toOid(b.patientId), doctorId: toOid(req.user.profileId), visitAt: b.visitAt, diagnoses: b.diagnoses, vitals: b.vitals || {}, medications: b.medications, notes: b.notes || '', followUpRequired: b.followUpRequired, createdAt: new Date() };
    if (b.appointmentId) {
      const a = await db.collection('appointments').findOne({ _id: toOid(b.appointmentId), doctorId: rec.doctorId, patientId: rec.patientId });
      if (!a) throw bad('appointmentId does not match this doctor and patient');
      rec.appointmentId = a._id;
    }
    const r = await db.collection('medical_records').insertOne(rec);
    await audit(db, req.user, 'create', 'medical_record', r.insertedId.toString());
    res.status(201).json({ ...rec, _id: r.insertedId });
  } catch (e) { next(e); }
});

const updateSchema = createSchema.omit({ patientId: true, appointmentId: true, visitAt: true }).partial().refine((o) => Object.keys(o).length > 0, 'No fields supplied');

async function ownRecord(db, req) {
  const rec = await db.collection('medical_records').findOne({ _id: toOid(req.params.id) });
  if (!rec) throw notFound('Record not found');
  if (String(rec.doctorId) !== req.user.profileId) throw forbidden('Only the authoring doctor can change this record');
  return rec;
}

router.put('/:id', requireRole('doctor'), validate({ params: z.object({ id: objectIdStr }), body: updateSchema }), async (req, res, next) => {
  try {
    const db = await getDb(), rec = await ownRecord(db, req);
    const r = await db.collection('medical_records').findOneAndUpdate({ _id: rec._id }, { $set: { ...req.body, updatedAt: new Date() } }, { returnDocument: 'after' });
    await audit(db, req.user, 'update', 'medical_record', req.params.id);
    res.json(r);
  } catch (e) { next(e); }
});

router.delete('/:id', requireRole('doctor'), validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const db = await getDb(), rec = await ownRecord(db, req);
    await db.collection('medical_records').deleteOne({ _id: rec._id });
    await audit(db, req.user, 'delete', 'medical_record', req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/patient/:id', validate({ params: z.object({ id: objectIdStr }), query: pagination }), async (req, res, next) => {
  try {
    const db = await getDb();
    await assertPatientAccess(db, req.user, req.params.id);
    const { page, limit } = req.query, filter = { patientId: toOid(req.params.id) };
    const [data, total] = await Promise.all([
      db.collection('medical_records').aggregate([{ $match: filter }, { $sort: { visitAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'd' } }, { $unwind: '$d' }, { $addFields: { doctorName: '$d.name', specialty: '$d.specialty' } }, { $project: { d: 0 } }]).toArray(),
      db.collection('medical_records').countDocuments(filter),
    ]);
    await audit(db, req.user, 'read', 'patient_records', req.params.id);
    res.json({ data, ...pageMeta(page, limit, total) });
  } catch (e) { next(e); }
});

module.exports = router;
