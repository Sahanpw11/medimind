'use strict';
// JSON Schema validators applied with collMod (validationLevel strict).
// bsonType is used (not "type") so ObjectId / Date are enforced as BSON types.
const oidField = { bsonType: 'objectId' };
const dateField = { bsonType: 'date' };

const users = {
  bsonType: 'object',
  required: ['email', 'passwordHash', 'role', 'status', 'createdAt'],
  properties: {
    email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
    passwordHash: { bsonType: 'string', minLength: 20 },
    role: { enum: ['patient', 'doctor', 'admin'] },
    status: { enum: ['active', 'disabled'] },
    createdAt: dateField,
  },
};

const patients = {
  bsonType: 'object',
  required: ['userId', 'fullName', 'dateOfBirth', 'allergies', 'emergencyContact', 'createdAt'],
  properties: {
    userId: oidField,
    fullName: { bsonType: 'string', minLength: 2, maxLength: 120 },
    dateOfBirth: dateField,
    contact: { bsonType: 'object', properties: { email: { bsonType: 'string' }, phone: { bsonType: 'string' } } },
    address: { bsonType: 'object', properties: { city: { bsonType: 'string' }, country: { bsonType: 'string' } } },
    allergies: {
      bsonType: 'array',
      maxItems: 50, // bounded embedded array: protects document growth
      items: {
        bsonType: 'object',
        required: ['substance', 'severity'],
        properties: {
          substance: { bsonType: 'string', minLength: 1 },
          severity: { enum: ['Mild', 'Moderate', 'Severe'] },
        },
      },
    },
    emergencyContact: {
      bsonType: 'object',
      required: ['name', 'relationship'],
      properties: { name: { bsonType: 'string' }, relationship: { bsonType: 'string' }, phone: { bsonType: 'string' } },
    },
    createdAt: dateField,
  },
};

const appointments = {
  bsonType: 'object',
  required: ['patientId', 'doctorId', 'startAt', 'endAt', 'status', 'consultationType', 'createdAt'],
  properties: {
    patientId: oidField,
    doctorId: oidField,
    startAt: dateField,
    endAt: dateField,
    status: { enum: ['booked', 'confirmed', 'completed', 'cancelled', 'no_show'] },
    consultationType: { enum: ['online', 'in_person'] },
    reason: { bsonType: 'string', maxLength: 500 },
    createdAt: dateField,
  },
};

const medical_records = {
  bsonType: 'object',
  required: ['patientId', 'doctorId', 'visitAt', 'diagnoses', 'createdAt'],
  properties: {
    patientId: oidField,
    doctorId: oidField,
    visitAt: dateField,
    diagnoses: {
      bsonType: 'array',
      maxItems: 20,
      items: { bsonType: 'object', required: ['code', 'description'], properties: { code: { bsonType: 'string' }, description: { bsonType: 'string' } } },
    },
    vitals: {
      bsonType: 'object',
      properties: {
        systolicBP: { bsonType: ['int', 'double', 'long'], minimum: 40, maximum: 300 },
        diastolicBP: { bsonType: ['int', 'double', 'long'], minimum: 20, maximum: 200 },
        heartRate: { bsonType: ['int', 'double', 'long'], minimum: 20, maximum: 250 },
      },
    },
    medications: { bsonType: 'array', maxItems: 30 },
    followUpRequired: { bsonType: 'bool' },
    createdAt: dateField,
  },
};

module.exports = { users, patients, appointments, medical_records };
