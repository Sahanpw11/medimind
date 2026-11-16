'use strict';
const request = require('supertest');
const { setup, teardown, patientAuth, doctorAuth, adminAuth, freeSlot, oid } = require('./helpers');

let app, db;
const DOC1 = oid('doctor', 1).toString();
beforeAll(async () => { ({ app, db } = await setup()); });
afterAll(teardown);
const api = () => request(app);

describe('auth', () => {
  test('registers a patient and ignores a client-supplied role', async () => {
    const r = await api().post('/api/auth/register').send({ email: 'New.User@demo.test', password: 'Passw0rdX', fullName: 'New User', dateOfBirth: '1990-01-02', role: 'admin' });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('patient');
    expect(r.headers['set-cookie'].join(';')).toMatch(/HttpOnly/);
    expect((await db.collection('users').findOne({ email: 'new.user@demo.test' })).role).toBe('patient');
  });
  test('rejects duplicate email with 409', async () => {
    const r = await api().post('/api/auth/register').send({ email: 'patient@demo.test', password: 'Passw0rdX', fullName: 'Dup', dateOfBirth: '1990-01-02' });
    expect(r.status).toBe(409);
  });
  test('rejects weak password / missing fields with 400 and field details', async () => {
    const r = await api().post('/api/auth/register').send({ email: 'x@demo.test', password: 'short' });
    expect(r.status).toBe(400);
    expect(r.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['password', 'fullName']));
  });
  test('login succeeds with correct credentials', async () => {
    const r = await api().post('/api/auth/login').send({ email: 'patient@demo.test', password: 'Demo@12345' });
    expect(r.status).toBe(200);
    expect(r.body.user.profileId).toBe(oid('patient', 1).toString());
  });
  test('login rejects invalid credentials with 401', async () => {
    expect((await api().post('/api/auth/login').send({ email: 'patient@demo.test', password: 'wrong-pass' })).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'nobody@demo.test', password: 'Demo@12345' })).status).toBe(401);
  });
  test('protected routes require a token; tampered token is rejected', async () => {
    expect((await api().get('/api/appointments')).status).toBe(401);
    expect((await api().get('/api/appointments').set('Authorization', patientAuth(1) + 'x')).status).toBe(401);
  });
});

describe('patients & authorization', () => {
  test('patient updates own profile', async () => {
    const r = await api().put(`/api/patients/${oid('patient', 1)}`).set('Authorization', patientAuth(1)).send({ allergies: [{ substance: 'Latex', severity: 'Mild' }] });
    expect(r.status).toBe(200);
    expect(r.body.allergies[0].substance).toBe('Latex');
  });
  test('cross-patient read and write are denied (403)', async () => {
    expect((await api().get(`/api/patients/${oid('patient', 2)}`).set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().put(`/api/patients/${oid('patient', 2)}`).set('Authorization', patientAuth(1)).send({ fullName: 'Hacked' })).status).toBe(403);
  });
  test('profile update validates input and strips unknown fields', async () => {
    const bad = await api().put(`/api/patients/${oid('patient', 1)}`).set('Authorization', patientAuth(1)).send({ allergies: [{ substance: 'X', severity: 'Deadly' }] });
    expect(bad.status).toBe(400);
    const ok = await api().put(`/api/patients/${oid('patient', 1)}`).set('Authorization', patientAuth(1)).send({ fullName: 'Okay Name', userId: oid('user', 5).toString() });
    expect(String(ok.body.userId)).toBe(oid('user', 1001).toString());
  });
  test('admin cannot open patient detail (no blanket clinical access)', async () => {
    expect((await api().get(`/api/patients/${oid('patient', 1)}`).set('Authorization', adminAuth())).status).toBe(403);
  });
});

describe('patient onboarding flag', () => {
  test('new registrations start with onboarding pending; completing it is one-way', async () => {
    const reg = await api().post('/api/auth/register').send({ email: `onb.${Date.now()}@demo.test`, password: 'Passw0rdX', fullName: 'Onboard Me', dateOfBirth: '1991-01-01' });
    expect(reg.status).toBe(201);
    const auth = 'Bearer ' + require('jsonwebtoken').sign({ sub: reg.body.user.id, role: 'patient', pid: reg.body.user.profileId }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const id = reg.body.user.profileId;
    expect((await api().get(`/api/patients/${id}`).set('Authorization', auth)).body.onboardingDone).toBe(false);
    expect((await api().put(`/api/patients/${id}`).set('Authorization', auth).send({ onboardingDone: false })).status).toBe(400); // cannot reset
    const done = await api().put(`/api/patients/${id}`).set('Authorization', auth).send({ emergencyContact: { name: 'Kamal Perera', relationship: 'Brother' }, allergies: [{ substance: 'Latex', severity: 'Mild' }], onboardingDone: true });
    expect(done.status).toBe(200);
    expect(done.body.onboardingDone).toBe(true);
    expect(done.body.emergencyContact.name).toBe('Kamal Perera');
  });
  test('seeded patients are not forced through onboarding', async () => {
    const p = await api().get(`/api/patients/${oid('patient', 1)}`).set('Authorization', patientAuth(1));
    expect(p.body.onboardingDone).toBeUndefined();
  });
});

describe('doctors', () => {
  test('search, filter, sort and paginate with safe limits', async () => {
    const r = await api().get('/api/doctors?specialty=Cardiology&limit=5&page=1').set('Authorization', patientAuth(1));
    expect(r.status).toBe(200);
    expect(r.body.data.every((d) => d.specialty === 'Cardiology')).toBe(true);
    expect(r.body.data[0].userId).toBeUndefined();
    expect((await api().get('/api/doctors?limit=1000').set('Authorization', patientAuth(1))).status).toBe(400);
  });
  test('operator-injection style query is rejected, regex is escaped', async () => {
    expect((await api().get('/api/doctors?q[$ne]=x').set('Authorization', patientAuth(1))).status).toBe(400);
    expect((await api().get('/api/doctors?q=.*').set('Authorization', patientAuth(1))).body.total).toBe(0);
  });
  test('only admins may create doctors', async () => {
    expect((await api().post('/api/doctors').set('Authorization', patientAuth(1)).send({})).status).toBe(403);
  });
});

describe('appointments', () => {
  const slot = freeSlot(170, 10);
  let apptId;
  test('books an available slot (201) and the slot becomes taken', async () => {
    const r = await api().post('/api/appointments').set('Authorization', patientAuth(1)).send({ doctorId: DOC1, startAt: slot.toISOString(), consultationType: 'online', reason: 'Checkup' });
    expect(r.status).toBe(201);
    apptId = r.body._id;
    expect(await db.collection('slot_reservations').countDocuments({ doctorId: oid('doctor', 1), slotStart: slot })).toBe(1);
    const s = await api().get(`/api/doctors/${DOC1}/slots?date=${slot.toISOString().slice(0, 10)}`).set('Authorization', patientAuth(2));
    expect(s.body.slots.find((x) => x.startAt === slot.toISOString()).status).toBe('taken');
  });
  test('a conflicting booking is rejected with 409', async () => {
    const r = await api().post('/api/appointments').set('Authorization', patientAuth(2)).send({ doctorId: DOC1, startAt: slot.toISOString(), consultationType: 'online' });
    expect(r.status).toBe(409);
  });
  test('invalid dates and missing fields are rejected', async () => {
    const post = (b) => api().post('/api/appointments').set('Authorization', patientAuth(3)).send(b);
    expect((await post({ doctorId: DOC1, startAt: 'not-a-date', consultationType: 'online' })).status).toBe(400);
    expect((await post({ doctorId: DOC1, startAt: '2020-01-01T10:00:00Z', consultationType: 'online' })).status).toBe(400); // past
    expect((await post({ doctorId: DOC1, startAt: freeSlot(170, 10).toISOString().replace(':00:00', ':17:00'), consultationType: 'online' })).status).toBe(400); // misaligned
    expect((await post({ doctorId: DOC1, startAt: freeSlot(170, 3).toISOString(), consultationType: 'online' })).status).toBe(400); // outside hours
    expect((await post({ consultationType: 'online' })).status).toBe(400); // missing
  });
  test('doctors and admins cannot book on behalf of patients', async () => {
    expect((await api().post('/api/appointments').set('Authorization', doctorAuth(1)).send({ doctorId: DOC1, startAt: freeSlot(171, 11).toISOString(), consultationType: 'online' })).status).toBe(403);
  });
  test('doctor lists only their own appointments; patient only theirs', async () => {
    const d = await api().get('/api/appointments?limit=100').set('Authorization', doctorAuth(1));
    expect(d.status).toBe(200);
    expect(d.body.data.length).toBeGreaterThan(0);
    expect(d.body.data.every((a) => a.doctorId === DOC1)).toBe(true);
    const p = await api().get('/api/appointments?limit=100').set('Authorization', patientAuth(1));
    expect(p.body.data.every((a) => a.patientId === oid('patient', 1).toString())).toBe(true);
  });
  test('admin list hides free-text reason', async () => {
    const r = await api().get('/api/appointments?limit=5').set('Authorization', adminAuth());
    expect(r.body.data[0].reason).toBeUndefined();
  });
  test("another patient cannot cancel someone else's appointment", async () => {
    expect((await api().patch(`/api/appointments/${apptId}`).set('Authorization', patientAuth(2)).send({ status: 'cancelled' })).status).toBe(403);
  });
  test('reschedule moves the reservation; cancel frees the slot', async () => {
    const newSlot = freeSlot(170, 11);
    const r = await api().patch(`/api/appointments/${apptId}`).set('Authorization', patientAuth(1)).send({ startAt: newSlot.toISOString() });
    expect(r.status).toBe(200);
    expect(await db.collection('slot_reservations').countDocuments({ doctorId: oid('doctor', 1), slotStart: slot })).toBe(0);
    expect(await db.collection('slot_reservations').countDocuments({ doctorId: oid('doctor', 1), slotStart: newSlot })).toBe(1);
    expect((await api().patch(`/api/appointments/${apptId}`).set('Authorization', patientAuth(1)).send({ status: 'cancelled' })).status).toBe(200);
    expect(await db.collection('slot_reservations').countDocuments({ appointmentId: oid('appointment', 0) })).toBe(0);
    expect((await api().post('/api/appointments').set('Authorization', patientAuth(2)).send({ doctorId: DOC1, startAt: newSlot.toISOString(), consultationType: 'online' })).status).toBe(201);
    expect((await api().patch(`/api/appointments/${apptId}`).set('Authorization', patientAuth(1)).send({ status: 'confirmed' })).status).toBe(400); // cancelled is terminal
  });
});

describe('medical records', () => {
  let patientN, apptDoc;
  beforeAll(async () => {
    apptDoc = await db.collection('appointments').findOne({ doctorId: oid('doctor', 1), status: { $ne: 'cancelled' } });
    patientN = parseInt(apptDoc.patientId.toString().slice(2), 16);
  });
  const rec = (pid) => ({ patientId: pid.toString(), visitAt: new Date().toISOString(), diagnoses: [{ code: 'Z00.0', description: 'General examination' }], vitals: { heartRate: 70 } });
  test('doctor with a relationship creates a record; without one gets 403', async () => {
    expect((await api().post('/api/medical-records').set('Authorization', doctorAuth(1)).send(rec(apptDoc.patientId))).status).toBe(201);
    const stranger = await db.collection('patients').findOne({ _id: { $nin: (await db.collection('appointments').distinct('patientId', { doctorId: oid('doctor', 1) })) } });
    expect((await api().post('/api/medical-records').set('Authorization', doctorAuth(1)).send(rec(stranger._id))).status).toBe(403);
  });
  test('patients cannot create records; invalid payload is 400', async () => {
    expect((await api().post('/api/medical-records').set('Authorization', patientAuth(1)).send(rec(oid('patient', 1)))).status).toBe(403);
    expect((await api().post('/api/medical-records').set('Authorization', doctorAuth(1)).send({ patientId: apptDoc.patientId.toString() })).status).toBe(400);
  });
  test('history: owner OK, other patient 403, admin 403, assigned doctor OK', async () => {
    expect((await api().get(`/api/medical-records/patient/${apptDoc.patientId}`).set('Authorization', patientAuth(patientN))).status).toBe(200);
    const other = patientN === 7 ? 8 : 7;
    expect((await api().get(`/api/medical-records/patient/${apptDoc.patientId}`).set('Authorization', patientAuth(other))).status).toBe(403);
    expect((await api().get(`/api/medical-records/patient/${apptDoc.patientId}`).set('Authorization', adminAuth())).status).toBe(403);
    expect((await api().get(`/api/medical-records/patient/${apptDoc.patientId}`).set('Authorization', doctorAuth(1))).status).toBe(200);
  });
  test('clinical reads are written to the audit log', async () => {
    expect(await db.collection('audit_logs').countDocuments({ action: 'read', resourceType: 'patient_records' })).toBeGreaterThan(0);
  });
});

describe('documents', () => {
  const pdf = Buffer.from('%PDF-1.4\n% synthetic demo\n');
  let docId;
  test('uploads a PDF, stores metadata + checksum, retrieves via controlled endpoint', async () => {
    const r = await api().post('/api/documents').set('Authorization', patientAuth(1)).attach('file', pdf, { filename: 'lab.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(201);
    expect(r.body.checksum).toHaveLength(64);
    docId = r.body._id;
    const dl = await api().get(`/api/documents/${docId}/download`).set('Authorization', patientAuth(1));
    expect(dl.status).toBe(200);
    expect(Buffer.from(dl.body).toString()).toContain('%PDF');
  });
  test('another patient cannot download it (403)', async () => {
    expect((await api().get(`/api/documents/${docId}/download`).set('Authorization', patientAuth(2))).status).toBe(403);
  });
  test('rejects disguised executables, oversize files and missing files', async () => {
    expect((await api().post('/api/documents').set('Authorization', patientAuth(1)).attach('file', Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), { filename: 'evil.pdf', contentType: 'application/pdf' })).status).toBe(400);
    expect((await api().post('/api/documents').set('Authorization', patientAuth(1)).attach('file', Buffer.alloc(5 * 1024 * 1024, 0x41), { filename: 'big.txt', contentType: 'text/plain' })).status).toBe(400);
    expect((await api().post('/api/documents').set('Authorization', patientAuth(1))).status).toBe(400);
  });
  test('lists metadata without exposing storage keys', async () => {
    const r = await api().get('/api/documents').set('Authorization', patientAuth(1));
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data[0].storageKey).toBeUndefined();
  });
});

describe('AI proxy', () => {
  test('returns a safe fallback with disclaimer when the AI service is down', async () => {
    const r = await api().post('/api/ai/chat').set('Authorization', patientAuth(1)).send({ question: 'What is a routine checkup?', sessionId: 't1' });
    expect(r.status).toBe(200);
    expect(r.body.degraded).toBe(true);
    expect(r.body.disclaimer).toMatch(/not medical advice/i);
    expect(r.body.emergency).toBeTruthy();
    const conv = await db.collection('ai_conversations').findOne({ sessionId: 't1' });
    expect(conv.messageCount).toBe(2);
  });
  test('validates input and restricts role', async () => {
    expect((await api().post('/api/ai/chat').set('Authorization', patientAuth(1)).send({ question: '' })).status).toBe(400);
    expect((await api().post('/api/ai/chat').set('Authorization', doctorAuth(1)).send({ question: 'hello there' })).status).toBe(403);
  });
});

describe('chat history', () => {
  test('each chat is kept separately, listed newest first, scoped to its owner, and deletable', async () => {
    const ask = (n, sessionId, question) => api().post('/api/ai/chat').set('Authorization', patientAuth(n)).send({ question, sessionId });
    await ask(50, 'c-one', 'What is a routine checkup?');
    await ask(50, 'c-two', 'How much sleep do adults need?');
    await ask(50, 'c-two', 'What are vital signs?');
    const list = await api().get('/api/ai/conversations').set('Authorization', patientAuth(50));
    expect(list.status).toBe(200);
    expect(list.body.data.map((c) => c.sessionId)).toEqual(['c-two', 'c-one']);
    expect(list.body.data[0].title).toBe('How much sleep do adults need?');
    expect(list.body.data[0].messageCount).toBe(4);
    const h = await api().get('/api/ai/history?sessionId=c-one').set('Authorization', patientAuth(50));
    expect(h.body.data).toHaveLength(2);
    // another patient sees none of it, and cannot delete it
    expect((await api().get('/api/ai/conversations').set('Authorization', patientAuth(51))).body.data).toHaveLength(0);
    expect((await api().delete('/api/ai/conversations/c-one').set('Authorization', patientAuth(51))).status).toBe(404);
    expect((await api().delete('/api/ai/conversations/c-one').set('Authorization', patientAuth(50))).status).toBe(204);
    expect((await api().get('/api/ai/history?sessionId=c-one').set('Authorization', patientAuth(50))).body.data).toHaveLength(0);
    expect((await api().get('/api/ai/conversations').set('Authorization', patientAuth(50))).body.data.map((c) => c.sessionId)).toEqual(['c-two']);
  });
  test('chat history is patient-only', async () => {
    expect((await api().get('/api/ai/conversations').set('Authorization', doctorAuth(1))).status).toBe(403);
    expect((await api().get('/api/ai/conversations')).status).toBe(401);
  });
});

describe('analytics', () => {
  test('admin overview matches independent control totals', async () => {
    const r = await api().get('/api/analytics/overview?from=2000-01-01&to=2100-01-01').set('Authorization', adminAuth());
    expect(r.status).toBe(200);
    const total = await db.collection('appointments').countDocuments();
    expect(r.body.totals.appointments).toBe(total);
    expect(r.body.byStatus.reduce((s, x) => s + x.count, 0)).toBe(total);
    expect(r.body.monthlyTrend.reduce((s, x) => s + x.count, 0)).toBe(total);
    expect(r.body.totals.noShows).toBe(await db.collection('appointments').countDocuments({ status: 'no_show' }));
    expect(r.body.volumeByDoctor.length).toBeLessThanOrEqual(10);
  });
  test('non-admins are forbidden', async () => {
    expect((await api().get('/api/analytics/overview').set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().get('/api/analytics/overview').set('Authorization', doctorAuth(1))).status).toBe(403);
  });
});

describe('doctor dashboard', () => {
  test('is scoped to the signed-in doctor and matches independent control totals', async () => {
    const r = await api().get('/api/analytics/doctor').set('Authorization', doctorAuth(1));
    expect(r.status).toBe(200);
    const now = new Date(), day0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const mine = { doctorId: oid('doctor', 1) };
    expect(r.body.today.every((a) => a.patientName)).toBe(true);
    expect(r.body.today).toHaveLength(await db.collection('appointments').countDocuments({ ...mine, startAt: { $gte: day0, $lt: new Date(day0.getTime() + 864e5) }, status: { $in: ['booked', 'confirmed', 'completed', 'no_show'] } }));
    expect(r.body.awaiting).toBe(await db.collection('appointments').countDocuments({ ...mine, status: 'booked', startAt: { $gte: new Date(r.body.generatedAt) } }));
    expect(r.body.daily).toHaveLength(14);
    expect(r.body.daily.reduce((s, d) => s + d.count, 0)).toBe(await db.collection('appointments').countDocuments({ ...mine, status: { $in: ['booked', 'confirmed', 'completed'] }, startAt: { $gte: day0, $lt: new Date(day0.getTime() + 14 * 864e5) } }));
    // nothing from other doctors leaks in
    const other = await api().get('/api/analytics/doctor').set('Authorization', doctorAuth(2));
    expect(JSON.stringify(other.body.attention)).not.toContain(String(oid('doctor', 1)));
  });
  test('patients and admins are forbidden', async () => {
    expect((await api().get('/api/analytics/doctor').set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().get('/api/analytics/doctor').set('Authorization', adminAuth())).status).toBe(403);
  });
});

describe('patient and admin dashboards', () => {
  test('patient dashboard is scoped to the patient and matches control totals', async () => {
    const r = await api().get('/api/analytics/patient').set('Authorization', patientAuth(1));
    expect(r.status).toBe(200);
    const now = new Date(r.body.generatedAt), mine = { patientId: oid('patient', 1) };
    expect(r.body.upcomingCount).toBe(await db.collection('appointments').countDocuments({ ...mine, status: { $in: ['booked', 'confirmed'] }, startAt: { $gte: now } }));
    expect(r.body.records).toBe(await db.collection('medical_records').countDocuments(mine));
    expect(r.body.documents).toBe(await db.collection('medical_documents').countDocuments(mine));
    expect(r.body.monthly).toHaveLength(12);
    expect(r.body.monthly.reduce((s, m) => s + m.count, 0)).toBe(r.body.completed12);
    expect(r.body.upcoming.every((a) => a.doctorName)).toBe(true);
    const vit = r.body.vitals.map((v) => v.visitAt);
    expect([...vit].sort()).toEqual(vit); // oldest to newest
  });
  test('patient dashboard is patient-only', async () => {
    expect((await api().get('/api/analytics/patient').set('Authorization', doctorAuth(1))).status).toBe(403);
    expect((await api().get('/api/analytics/patient').set('Authorization', adminAuth())).status).toBe(403);
  });
  test('admin operations match control totals and expose no patient details', async () => {
    const r = await api().get('/api/analytics/operations').set('Authorization', adminAuth());
    expect(r.status).toBe(200);
    expect(r.body.doctors).toBe(await db.collection('doctors').countDocuments());
    expect(r.body.daily).toHaveLength(14);
    expect(r.body.utilisation.every((u) => u.pct >= 0 && u.booked <= u.capacity + 1000)).toBe(true);
    const day0 = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    expect(r.body.daily.reduce((s, d) => s + d.count, 0)).toBe(await db.collection('appointments').countDocuments({ status: { $in: ['booked', 'confirmed', 'completed'] }, startAt: { $gte: day0, $lt: new Date(day0.getTime() + 14 * 864e5) } }));
    expect(JSON.stringify(r.body)).not.toMatch(/patientId|patientName|fullName/);
    expect((await api().get('/api/analytics/operations').set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().get('/api/analytics/operations').set('Authorization', doctorAuth(1))).status).toBe(403);
  });
});

describe('notifications', () => {
  test('booking notifies both the patient and the doctor; each sees only their own', async () => {
    const slot = freeSlot(160, 12);
    const b = await api().post('/api/appointments').set('Authorization', patientAuth(40)).send({ doctorId: DOC1, startAt: slot.toISOString(), consultationType: 'online' });
    expect(b.status).toBe(201);
    const p = await api().get('/api/notifications').set('Authorization', patientAuth(40));
    expect(p.body.data.some((n) => n.type === 'appointment_booked')).toBe(true);
    expect(p.body.data.every((n) => n.type !== 'appointment_new')).toBe(true);
    const d = await api().get('/api/notifications').set('Authorization', doctorAuth(1));
    expect(d.body.data.some((n) => n.type === 'appointment_new')).toBe(true);
    expect(d.body.unread).toBeGreaterThan(0);
  });
  test('marking read clears the unread count; unauthenticated is 401', async () => {
    expect((await api().post('/api/notifications/read').set('Authorization', doctorAuth(1))).status).toBe(200);
    expect((await api().get('/api/notifications').set('Authorization', doctorAuth(1))).body.unread).toBe(0);
    expect((await api().get('/api/notifications')).status).toBe(401);
  });
});

describe('CRUD completion: doctors, appointments, medical records, documents', () => {
  const pdf = Buffer.from('%PDF-1.4\n% crud test\n');

  test('doctors: admin creates, reads, updates and deletes; history blocks deletion; others are forbidden', async () => {
    const email = `crud.doc.${Date.now()}@demo.test`;
    const created = await api().post('/api/doctors').set('Authorization', adminAuth()).send({ email, password: 'Passw0rdX', name: 'Dr. Crud Test', specialty: 'Cardiology', availability: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }] });
    expect(created.status).toBe(201);
    const id = created.body._id;
    expect((await api().get(`/api/doctors/${id}`).set('Authorization', adminAuth())).body.name).toBe('Dr. Crud Test');
    expect((await api().put(`/api/doctors/${id}`).set('Authorization', adminAuth()).send({ specialty: 'Neurology' })).body.specialty).toBe('Neurology');
    expect((await api().delete(`/api/doctors/${id}`).set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().delete(`/api/doctors/${id}`).set('Authorization', adminAuth())).status).toBe(204);
    expect((await api().get(`/api/doctors/${id}`).set('Authorization', adminAuth())).status).toBe(404);
    expect(await db.collection('users').countDocuments({ email })).toBe(0); // login removed with the doctor
    expect((await api().delete(`/api/doctors/${DOC1}`).set('Authorization', adminAuth())).status).toBe(409); // has appointment history
  });

  test('appointments: admin can delete only a cancelled appointment', async () => {
    const slot = freeSlot(155, 15);
    const b = await api().post('/api/appointments').set('Authorization', patientAuth(60)).send({ doctorId: DOC1, startAt: slot.toISOString(), consultationType: 'online' });
    expect(b.status).toBe(201);
    expect((await api().delete(`/api/appointments/${b.body._id}`).set('Authorization', adminAuth())).status).toBe(400); // still active
    expect((await api().delete(`/api/appointments/${b.body._id}`).set('Authorization', patientAuth(60))).status).toBe(403);
    expect((await api().patch(`/api/appointments/${b.body._id}`).set('Authorization', patientAuth(60)).send({ status: 'cancelled' })).status).toBe(200);
    expect((await api().delete(`/api/appointments/${b.body._id}`).set('Authorization', adminAuth())).status).toBe(204);
    expect(await db.collection('appointments').countDocuments({ _id: new (require('mongodb').ObjectId)(b.body._id) })).toBe(0);
  });

  test('medical records: only the authoring doctor can update or delete', async () => {
    const appt = await db.collection('appointments').findOne({ doctorId: oid('doctor', 1), status: { $ne: 'cancelled' } });
    const make = await api().post('/api/medical-records').set('Authorization', doctorAuth(1)).send({ patientId: appt.patientId.toString(), visitAt: new Date().toISOString(), diagnoses: [{ code: 'Z00.0', description: 'General examination' }] });
    expect(make.status).toBe(201);
    const id = make.body._id;
    const upd = await api().put(`/api/medical-records/${id}`).set('Authorization', doctorAuth(1)).send({ notes: 'Edited note', followUpRequired: true });
    expect(upd.status).toBe(200);
    expect(upd.body.notes).toBe('Edited note');
    expect((await api().put(`/api/medical-records/${id}`).set('Authorization', doctorAuth(2)).send({ notes: 'hijack' })).status).toBe(403);
    expect((await api().put(`/api/medical-records/${id}`).set('Authorization', patientAuth(1)).send({ notes: 'hijack' })).status).toBe(403);
    expect((await api().put(`/api/medical-records/${id}`).set('Authorization', doctorAuth(1)).send({})).status).toBe(400);
    expect((await api().delete(`/api/medical-records/${id}`).set('Authorization', doctorAuth(2))).status).toBe(403);
    expect((await api().delete(`/api/medical-records/${id}`).set('Authorization', doctorAuth(1))).status).toBe(204);
    expect(await db.collection('medical_records').countDocuments({ _id: new (require('mongodb').ObjectId)(id) })).toBe(0);
  });

  test('documents: owner renames and deletes; the stored bytes are removed too; others are forbidden', async () => {
    const up = await api().post('/api/documents').set('Authorization', patientAuth(61)).attach('file', pdf, { filename: 'before.pdf', contentType: 'application/pdf' });
    expect(up.status).toBe(201);
    const id = up.body._id, fileId = new (require('mongodb').ObjectId)(up.body.storageKey);
    expect((await api().put(`/api/documents/${id}`).set('Authorization', patientAuth(62)).send({ filename: 'x.pdf' })).status).toBe(403);
    const ren = await api().put(`/api/documents/${id}`).set('Authorization', patientAuth(61)).send({ filename: 'after report.pdf' });
    expect(ren.status).toBe(200);
    expect(ren.body.filename).toBe('after report.pdf');
    expect((await db.collection('documents.files').findOne({ _id: fileId })).filename).toBe('after report.pdf');
    expect((await api().delete(`/api/documents/${id}`).set('Authorization', patientAuth(62))).status).toBe(403);
    expect((await api().delete(`/api/documents/${id}`).set('Authorization', patientAuth(61))).status).toBe(204);
    expect(await db.collection('documents.files').countDocuments({ _id: fileId })).toBe(0);
    expect((await api().get(`/api/documents/${id}/download`).set('Authorization', patientAuth(61))).status).toBe(404);
  });
});

describe('allergy search (brief Query C)', () => {
  test('a doctor finds only their own patients with the allergy; validation and roles enforced', async () => {
    const mine = await db.collection('appointments').distinct('patientId', { doctorId: oid('doctor', 1), status: { $ne: 'cancelled' } });
    const sample = await db.collection('patients').findOne({ _id: { $in: mine }, 'allergies.0': { $exists: true } });
    const substance = sample.allergies[0].substance;
    const r = await api().get(`/api/patients?allergy=${encodeURIComponent(substance.toLowerCase())}&limit=100`).set('Authorization', doctorAuth(1));
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data.every((p) => p.allergies.some((a) => a.substance.toLowerCase() === substance.toLowerCase()))).toBe(true);
    const mineSet = new Set(mine.map(String));
    expect(r.body.data.every((p) => mineSet.has(String(p._id)))).toBe(true); // never someone else's patient
    expect(r.body.total).toBe(await db.collection('patients').countDocuments({ _id: { $in: mine }, allergies: { $elemMatch: { substance: new RegExp(`^${substance}$`, 'i') } } }));
    expect((await api().get('/api/patients').set('Authorization', doctorAuth(1))).status).toBe(400);
    expect((await api().get('/api/patients?allergy=Latex').set('Authorization', patientAuth(1))).status).toBe(403);
    expect((await api().get('/api/patients?allergy[$ne]=x').set('Authorization', doctorAuth(1))).status).toBe(400);
  });
});

describe('error handling', () => {
  test('an internal failure returns 500 with a generic message and no stack trace', async () => {
    const original = globalThis.__mmClient;
    const broken = Promise.reject(new Error('db exploded at /secret/path'));
    broken.catch(() => undefined);
    globalThis.__mmClient = broken;
    try {
      const r = await api().get('/api/doctors').set('Authorization', patientAuth(1));
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(r.body)).not.toMatch(/exploded|secret|stack/);
    } finally { globalThis.__mmClient = original; }
    expect((await api().get('/api/doctors').set('Authorization', patientAuth(1))).status).toBe(200); // recovers
  });
  test('unknown routes return 404 JSON and malformed JSON returns 400', async () => {
    expect((await api().get('/api/nope')).status).toBe(404);
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{not json');
    expect(bad.status).toBe(400);
  });
});

describe('validators at the database layer', () => {
  test('MongoDB JSON Schema rejects an invalid appointment status even if the API is bypassed', async () => {
    await expect(db.collection('appointments').insertOne({ patientId: oid('patient', 1), doctorId: oid('doctor', 1), startAt: new Date(), endAt: new Date(), status: 'banana', consultationType: 'online', createdAt: new Date() })).rejects.toMatchObject({ code: 121 });
  });
  test('unique email index is enforced', async () => {
    await expect(db.collection('users').insertOne({ email: 'patient@demo.test', passwordHash: 'x'.repeat(30), role: 'patient', status: 'active', createdAt: new Date() })).rejects.toMatchObject({ code: 11000 });
  });
});
