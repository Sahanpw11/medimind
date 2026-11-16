'use strict';
// name -> [collection, keys, options]. Single source of truth for setup + explain.
const INDEXES = [
  ['users', { email: 1 }, { unique: true, name: 'uniq_email' }],
  ['appointments', { doctorId: 1, startAt: 1 }, { name: 'doctor_schedule' }],
  ['appointments', { patientId: 1, startAt: -1 }, { name: 'patient_history' }],
  ['slot_reservations', { doctorId: 1, slotStart: 1 }, { unique: true, name: 'uniq_doctor_slot' }],
  ['medical_records', { patientId: 1, visitAt: -1 }, { name: 'patient_records' }],
  ['patients', { 'allergies.substance': 1 }, { name: 'allergy_multikey' }],
  ['patients', { userId: 1 }, { unique: true, name: 'uniq_patient_user' }],
  ['doctors', { userId: 1 }, { unique: true, name: 'uniq_doctor_user' }],
  ['doctors', { specialty: 1, name: 1 }, { name: 'specialty_name' }],
  ['doctors', { name: 'text', specialty: 'text' }, { name: 'doctor_text' }],
  ['notifications', { recipientId: 1, createdAt: -1 }, { name: 'recipient_feed' }],
  ['ai_messages', { conversationId: 1, createdAt: 1 }, { name: 'conversation_messages' }],
  ['ai_conversations', { patientId: 1, sessionId: 1 }, { unique: true, name: 'uniq_patient_session' }],
  ['audit_logs', { resourceId: 1, createdAt: -1 }, { name: 'audit_resource' }],
  ['medical_documents', { patientId: 1, uploadedAt: -1 }, { name: 'patient_documents' }],
];

async function ensureIndexes(db) {
  for (const [coll, keys, opts] of INDEXES) await db.collection(coll).createIndex(keys, opts);
}

module.exports = { INDEXES, ensureIndexes };
