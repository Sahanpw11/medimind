'use strict';
// Deterministic synthetic data. Same SEED_ANCHOR => identical content and ObjectIds.
// ALL DATA IS FABRICATED. Emails use the reserved .test TLD.
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const { connect, oid } = require('./lib');
const { ensureCollections } = require('./collections');

const N_PATIENTS = 500, N_DOCTORS = 20, N_APPOINTMENTS = 2200;
const DEMO_PASSWORD = 'Demo@12345';
const SPECIALTIES = ['General Practice', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics', 'Neurology', 'Psychiatry', 'Gynecology'];
const ALLERGENS = ['Penicillin', 'Peanuts', 'Latex', 'Shellfish', 'Pollen', 'Aspirin', 'Dust mites', 'Sulfa drugs', 'Eggs'];
const DX = [['Z00.0', 'General examination'], ['I10', 'Essential hypertension'], ['E11.9', 'Type 2 diabetes, uncomplicated'], ['J06.9', 'Acute upper respiratory infection'],
  ['M54.5', 'Low back pain'], ['L20.9', 'Atopic dermatitis'], ['J45.9', 'Asthma, unspecified'], ['K21.9', 'Gastro-oesophageal reflux'], ['F41.1', 'Generalized anxiety disorder'], ['G43.9', 'Migraine, unspecified']];
const MEDS = ['Paracetamol 500mg', 'Amlodipine 5mg', 'Metformin 500mg', 'Salbutamol inhaler', 'Omeprazole 20mg'];
const CITIES = ['Colombo', 'Kandy', 'Galle', 'Jaffna', 'Negombo', 'Matara'];
const REL = ['Brother', 'Sister', 'Spouse', 'Parent', 'Friend'];
const DAY = 86400000, SLOT = 30 * 60000;

function weighted(rng, pairs) {
  let r = rng() * pairs.reduce((s, p) => s + p[1], 0);
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
}

async function seed(db, { anchor = process.env.SEED_ANCHOR || new Date().toISOString().slice(0, 10) } = {}) {
  faker.seed(42);
  const rng = () => faker.number.float({ min: 0, max: 1, fractionDigits: 6 });
  const now = new Date(anchor + 'T00:00:00Z');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const c of ['users', 'patients', 'doctors', 'appointments', 'slot_reservations', 'medical_records', 'notifications', 'medical_documents', 'ai_conversations', 'ai_messages', 'audit_logs', 'documents.files', 'documents.chunks']) { // GridFS bytes too, or reseeding leaves orphaned files
    await db.collection(c).deleteMany({});
  }
  await ensureCollections(db);

  const users = [], doctors = [], patients = [];
  users.push({ _id: oid('user', 0), email: 'admin@demo.test', passwordHash: hash, role: 'admin', status: 'active', createdAt: now });

  for (let i = 1; i <= N_DOCTORS; i++) {
    const uid = oid('user', i);
    const email = i === 1 ? 'doctor@demo.test' : `doctor${i}@demo.test`;
    users.push({ _id: uid, email, passwordHash: hash, role: 'doctor', status: 'active', createdAt: now });
    const days = i % 3 === 0 ? [1, 3, 5] : [1, 2, 3, 4, 5];
    doctors.push({
      _id: oid('doctor', i), userId: uid, name: `Dr. ${faker.person.firstName()} ${faker.person.lastName()}`,
      specialty: SPECIALTIES[(i - 1) % SPECIALTIES.length], clinic: { city: faker.helpers.arrayElement(CITIES) },
      consultationTypes: ['online', 'in_person'],
      availability: days.map((d) => ({ dayOfWeek: d, start: '09:00', end: '17:00' })), // UTC, 30-min slots
      createdAt: now,
    });
  }

  for (let i = 1; i <= N_PATIENTS; i++) {
    const uid = oid('user', 1000 + i);
    const first = faker.person.firstName(), last = faker.person.lastName();
    const email = i === 1 ? 'patient@demo.test' : `patient${i}@demo.test`;
    users.push({ _id: uid, email, passwordHash: hash, role: 'patient', status: 'active', createdAt: now });
    const nAll = weighted(rng, [[0, 50], [1, 30], [2, 15], [3, 5]]);
    patients.push({
      _id: oid('patient', i), userId: uid, fullName: `${first} ${last}`,
      dateOfBirth: new Date(Date.UTC(1940 + Math.floor(rng() * 66), Math.floor(rng() * 12), 1 + Math.floor(rng() * 28))),
      contact: { email, phone: '+94' + faker.string.numeric(9) },
      address: { city: faker.helpers.arrayElement(CITIES), country: 'Sri Lanka' },
      allergies: faker.helpers.arrayElements(ALLERGENS, nAll).map((s) => ({ substance: s, severity: faker.helpers.arrayElement(['Mild', 'Moderate', 'Severe']) })),
      emergencyContact: { name: `${faker.person.firstName()} ${last}`, relationship: faker.helpers.arrayElement(REL), phone: '+94' + faker.string.numeric(9) },
      createdAt: now,
    });
  }

  // Appointments: unique (doctor, slotStart) among non-cancelled ones => matches the reservation invariant.
  const appts = [], reservations = [], taken = new Set(), records = [], notifications = [];
  let n = 0, guard = 0;
  while (appts.length < N_APPOINTMENTS && guard++ < N_APPOINTMENTS * 20) {
    const di = 1 + Math.floor(rng() * N_DOCTORS), doc = doctors[di - 1];
    const day = new Date(now.getTime() + Math.floor((rng() - 0.6) * 300) * DAY); // ~ -6mo .. +4mo
    const dow = day.getUTCDay();
    if (!doc.availability.some((a) => a.dayOfWeek === dow)) continue;
    const startAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 9) + Math.floor(rng() * 16) * SLOT);
    const past = startAt < now;
    const status = past ? weighted(rng, [['completed', 70], ['cancelled', 14], ['no_show', 12], ['confirmed', 4]]) : weighted(rng, [['booked', 55], ['confirmed', 38], ['cancelled', 7]]);
    const key = doc._id.toString() + startAt.getTime();
    if (status !== 'cancelled') { if (taken.has(key)) continue; taken.add(key); }
    n++;
    const patient = patients[Math.floor(rng() * N_PATIENTS)];
    const a = { _id: oid('appointment', n), patientId: patient._id, doctorId: doc._id, startAt, endAt: new Date(startAt.getTime() + SLOT), status,
      consultationType: rng() < 0.4 ? 'online' : 'in_person', reason: faker.helpers.arrayElement(['Routine checkup', 'Follow-up visit', 'Skin concern', 'Back pain', 'Blood pressure review', 'Headaches']),
      createdAt: new Date(startAt.getTime() - Math.ceil(rng() * 21) * DAY) };
    appts.push(a);
    if (status !== 'cancelled') reservations.push({ _id: oid('appointment', 500000 + n), doctorId: doc._id, slotStart: startAt, appointmentId: a._id, createdAt: a.createdAt });
    if (status === 'completed' && rng() < 0.75) {
      const dx = faker.helpers.arrayElements(DX, 1 + Math.floor(rng() * 2));
      records.push({ _id: oid('record', records.length + 1), patientId: patient._id, doctorId: doc._id, appointmentId: a._id, visitAt: startAt,
        diagnoses: dx.map(([code, description]) => ({ code, description })),
        vitals: { systolicBP: 100 + Math.floor(rng() * 50), diastolicBP: 60 + Math.floor(rng() * 30), heartRate: 55 + Math.floor(rng() * 45) },
        medications: rng() < 0.4 ? [faker.helpers.arrayElement(MEDS)] : [], notes: 'Synthetic consultation summary.', followUpRequired: rng() < 0.2, createdAt: startAt });
    }
    if (rng() < 0.3) notifications.push({ _id: oid('notification', notifications.length + 1), recipientId: patient.userId, type: 'appointment_' + status, status: rng() < 0.6 ? 'read' : 'unread', message: `Your appointment is ${status}.`, createdAt: a.createdAt });
  }

  await db.collection('users').insertMany(users);
  await db.collection('doctors').insertMany(doctors);
  await db.collection('patients').insertMany(patients);
  await db.collection('appointments').insertMany(appts);
  await db.collection('slot_reservations').insertMany(reservations);
  await db.collection('medical_records').insertMany(records);
  await db.collection('notifications').insertMany(notifications);
  return { users: users.length, doctors: doctors.length, patients: patients.length, appointments: appts.length, reservations: reservations.length, medical_records: records.length, notifications: notifications.length };
}

module.exports = { seed, DEMO_PASSWORD };

if (require.main === module) {
  (async () => {
    const { client, db } = await connect();
    try { console.table(await seed(db)); console.log(`Demo password for all seeded accounts: ${DEMO_PASSWORD}`); }
    finally { await client.close(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
