'use strict';
const { ObjectId } = require('mongodb');
const { forbidden } = require('../errors');

// Doctor may access a patient only if they hold (or held) a non-cancelled appointment together.
async function doctorHasRelationship(db, doctorId, patientId) {
  return !!(await db.collection('appointments').findOne(
    { doctorId: new ObjectId(doctorId), patientId: new ObjectId(patientId), status: { $ne: 'cancelled' } }, { projection: { _id: 1 } }));
}

// Throws 403 unless the caller may see this patient's data. Admins never get clinical access.
async function assertPatientAccess(db, user, patientId) {
  if (user.role === 'patient' && String(user.profileId) === String(patientId)) return;
  if (user.role === 'doctor' && (await doctorHasRelationship(db, user.profileId, patientId))) return;
  throw forbidden();
}

async function audit(db, user, action, resourceType, resourceId) {
  await db.collection('audit_logs').insertOne({ actorId: new ObjectId(user.id), role: user.role, action, resourceType, resourceId: new ObjectId(resourceId), createdAt: new Date() });
}

module.exports = { doctorHasRelationship, assertPatientAccess, audit };
