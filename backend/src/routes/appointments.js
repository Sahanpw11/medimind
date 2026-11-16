'use strict';
const router = require('express').Router();
const { getDb } = require('../db');
const { validate, objectIdStr, toOid, pagination, pageMeta, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { bookAppointment, rescheduleAppointment, releaseSlot } = require('../services/booking');
const { forbidden, notFound, bad } = require('../errors');

router.use(authenticate);
const STATUSES = ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'];
const isoDate = z.coerce.date({ invalid_type_error: 'Must be a valid ISO date', required_error: 'Required' });

const createSchema = z.object({
  doctorId: objectIdStr, startAt: isoDate,
  consultationType: z.enum(['online', 'in_person']),
  reason: z.string().trim().max(500).optional(),
});

router.post('/', requireRole('patient'), validate({ body: createSchema }), async (req, res, next) => {
  try {
    const appt = await bookAppointment(await getDb(), { ...req.body, patientId: req.user.profileId, recipientUserId: req.user.id });
    res.status(201).json(appt);
  } catch (e) { next(e); }
});

const listQuery = pagination.extend({
  status: z.enum(STATUSES).optional(), from: isoDate.optional(), to: isoDate.optional(),
  sort: z.enum(['startAt', '-startAt']).default('-startAt'),
});

router.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const db = await getDb();
    const { page, limit, status, from, to, sort } = req.query;
    const match = {};
    if (req.user.role === 'patient') match.patientId = toOid(req.user.profileId);
    else if (req.user.role === 'doctor') match.doctorId = toOid(req.user.profileId);
    if (status) match.status = status;
    if (from || to) match.startAt = { ...(from && { $gte: from }), ...(to && { $lt: to }) };
    const pipeline = [
      { $match: match }, { $sort: { startAt: sort === 'startAt' ? 1 : -1, _id: 1 } },
      { $skip: (page - 1) * limit }, { $limit: limit },
      { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' } }, { $unwind: '$doctor' },
      { $lookup: { from: 'patients', localField: 'patientId', foreignField: '_id', as: 'patient' } }, { $unwind: '$patient' },
      { $project: { patientId: 1, doctorId: 1, startAt: 1, endAt: 1, status: 1, consultationType: 1, createdAt: 1,
        doctorName: '$doctor.name', specialty: '$doctor.specialty', patientName: '$patient.fullName',
        // free-text reason may be clinical: hidden from admins
        ...(req.user.role !== 'admin' && { reason: 1 }) } },
    ];
    const [data, total] = await Promise.all([db.collection('appointments').aggregate(pipeline).toArray(), db.collection('appointments').countDocuments(match)]);
    res.json({ data, ...pageMeta(page, limit, total) });
  } catch (e) { next(e); }
});

const TRANSITIONS = { booked: ['confirmed', 'cancelled', 'completed', 'no_show'], confirmed: ['cancelled', 'completed', 'no_show'] };
const patchSchema = z.object({ status: z.enum(STATUSES).optional(), startAt: isoDate.optional() })
  .refine((o) => (o.status ? 1 : 0) + (o.startAt ? 1 : 0) === 1, 'Provide exactly one of status or startAt');

router.patch('/:id', requireRole('patient', 'doctor', 'admin'), validate({ params: z.object({ id: objectIdStr }), body: patchSchema }), async (req, res, next) => {
  try {
    const db = await getDb();
    const appt = await db.collection('appointments').findOne({ _id: toOid(req.params.id) });
    if (!appt) throw notFound('Appointment not found');
    const { role, profileId } = req.user;
    const owns = (role === 'patient' && String(appt.patientId) === profileId) || (role === 'doctor' && String(appt.doctorId) === profileId);
    if (!owns && role !== 'admin') throw forbidden();
    if (!TRANSITIONS[appt.status]) throw bad(`A ${appt.status} appointment can no longer be changed`);

    if (req.body.startAt) { // reschedule
      if (role === 'doctor') throw forbidden('Doctors cannot reschedule patient bookings');
      await rescheduleAppointment(db, appt, req.body.startAt);
    } else {
      const next_ = req.body.status;
      if (!TRANSITIONS[appt.status].includes(next_)) throw bad(`Cannot change status from ${appt.status} to ${next_}`);
      if (role === 'patient' && next_ !== 'cancelled') throw forbidden('Patients may only cancel appointments');
      if (role === 'admin' && !['cancelled', 'confirmed'].includes(next_)) throw forbidden('Admins may only confirm or cancel');
      await releaseSlot(db, appt, next_);
    }
    res.json(await db.collection('appointments').findOne({ _id: appt._id }));
  } catch (e) { next(e); }
});

// Scheduling clean-up: only a cancelled appointment can be removed, and only by an admin.
router.delete('/:id', requireRole('admin'), validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const db = await getDb(), appt = await db.collection('appointments').findOne({ _id: toOid(req.params.id) });
    if (!appt) throw notFound('Appointment not found');
    if (appt.status !== 'cancelled') throw bad('Only cancelled appointments can be deleted. Cancel it first.');
    await db.collection('appointments').deleteOne({ _id: appt._id });
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
