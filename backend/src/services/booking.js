'use strict';
// Concurrency-safe booking for fixed 30-minute slots.
// A unique index on slot_reservations(doctorId, slotStart) is the arbiter: whichever
// transaction inserts the reservation first wins; the loser gets E11000 => HTTP 409.
// The reservation, appointment and notification commit atomically in one transaction.
const { ObjectId } = require('mongodb');
const config = require('../config');
const { getClient } = require('../db');
const { bad, conflict, notFound } = require('../errors');

const SLOT_MS = config.slotMinutes * 60000;

function validateSlot(doctor, startAt, now = new Date()) {
  if (!(startAt instanceof Date) || isNaN(startAt)) throw bad('startAt must be a valid ISO date');
  if (startAt <= now) throw bad('Appointment must be in the future');
  if (startAt > new Date(now.getTime() + config.maxBookingDaysAhead * 864e5)) throw bad(`Cannot book more than ${config.maxBookingDaysAhead} days ahead`);
  const mins = startAt.getUTCHours() * 60 + startAt.getUTCMinutes();
  if (startAt.getUTCSeconds() || startAt.getUTCMilliseconds() || mins % config.slotMinutes) throw bad(`Start time must align to ${config.slotMinutes}-minute slots`);
  const win = doctor.availability.find((a) => a.dayOfWeek === startAt.getUTCDay());
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  if (!win || mins < toMin(win.start) || mins + config.slotMinutes > toMin(win.end)) throw bad('Doctor is not available at that time');
}

const isDup = (e) => e && (e.code === 11000 || (e.errorLabels && e.codeName === 'DuplicateKey'));

async function bookAppointment(db, { patientId, doctorId, startAt, consultationType, reason, recipientUserId }) {
  const doctor = await db.collection('doctors').findOne({ _id: new ObjectId(doctorId) });
  if (!doctor) throw notFound('Doctor not found');
  validateSlot(doctor, startAt);
  if (!doctor.consultationTypes.includes(consultationType)) throw bad('Doctor does not offer that consultation type');

  const now = new Date();
  const appt = { _id: new ObjectId(), patientId: new ObjectId(patientId), doctorId: doctor._id, startAt, endAt: new Date(startAt.getTime() + SLOT_MS),
    status: 'booked', consultationType, reason: reason || 'Consultation', createdAt: now };
  const session = (await getClient()).startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('slot_reservations').insertOne({ doctorId: doctor._id, slotStart: startAt, appointmentId: appt._id, createdAt: now }, { session });
      await db.collection('appointments').insertOne(appt, { session });
      await db.collection('notifications').insertMany([
        { recipientId: new ObjectId(recipientUserId), type: 'appointment_booked', status: 'unread', message: `Appointment booked with ${doctor.name}.`, createdAt: now },
        { recipientId: doctor.userId, type: 'appointment_new', status: 'unread', message: `New appointment on ${startAt.toISOString().slice(0, 10)} at ${startAt.toISOString().slice(11, 16)} UTC.`, createdAt: now },
      ], { session });
    });
  } catch (e) {
    if (isDup(e)) throw conflict('That time slot has just been taken. Please choose another.');
    throw e;
  } finally { await session.endSession(); }
  return appt;
}

async function rescheduleAppointment(db, appt, newStart) {
  const doctor = await db.collection('doctors').findOne({ _id: appt.doctorId });
  validateSlot(doctor, newStart);
  const session = (await getClient()).startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('slot_reservations').insertOne({ doctorId: appt.doctorId, slotStart: newStart, appointmentId: appt._id, createdAt: new Date() }, { session });
      await db.collection('slot_reservations').deleteOne({ appointmentId: appt._id, slotStart: appt.startAt }, { session });
      await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { startAt: newStart, endAt: new Date(newStart.getTime() + SLOT_MS), status: 'booked' } }, { session });
    });
  } catch (e) {
    if (isDup(e)) throw conflict('That time slot has just been taken. Please choose another.');
    throw e;
  } finally { await session.endSession(); }
}

async function releaseSlot(db, appt, newStatus) {
  const session = (await getClient()).startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('appointments').updateOne({ _id: appt._id }, { $set: { status: newStatus } }, { session });
      if (newStatus === 'cancelled') await db.collection('slot_reservations').deleteOne({ appointmentId: appt._id }, { session });
    });
  } finally { await session.endSession(); }
}

module.exports = { bookAppointment, rescheduleAppointment, releaseSlot, validateSlot, SLOT_MS };
