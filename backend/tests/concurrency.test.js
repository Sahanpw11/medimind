'use strict';
// Simultaneous booking of the SAME slot: exactly one request may win.
const request = require('supertest');
const { setup, teardown, tokenFor, freeSlot, oid } = require('./helpers');

let app, db;
beforeAll(async () => { ({ app, db } = await setup()); });
afterAll(teardown);

test('20 simultaneous bookings for one slot => exactly 1x201 and 19x409, 1 reservation', async () => {
  const slot = freeSlot(172, 14);
  const doctorId = oid('doctor', 2).toString(); // Mon-Fri doctor
  const reqs = Array.from({ length: 20 }, (_, i) =>
    request(app).post('/api/appointments').set('Authorization', tokenFor('patient', oid('patient', 100 + i), oid('user', 1100 + i)))
      .send({ doctorId, startAt: slot.toISOString(), consultationType: 'in_person', reason: 'race' }));
  const results = await Promise.all(reqs);
  const codes = results.map((r) => r.status);
  console.log('status codes:', JSON.stringify(codes.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {})));
  expect(codes.filter((c) => c === 201)).toHaveLength(1);
  expect(codes.filter((c) => c === 409)).toHaveLength(19);
  expect(await db.collection('slot_reservations').countDocuments({ doctorId: oid('doctor', 2), slotStart: slot })).toBe(1);
  expect(await db.collection('appointments').countDocuments({ doctorId: oid('doctor', 2), startAt: slot })).toBe(1); // no orphan appointments
}, 60000);

test('same patient double-submitting is also safe', async () => {
  const slot = freeSlot(173, 15);
  const doctorId = oid('doctor', 4).toString();
  const auth = tokenFor('patient', oid('patient', 300), oid('user', 1300));
  const res = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/appointments').set('Authorization', auth).send({ doctorId, startAt: slot.toISOString(), consultationType: 'online' })));
  expect(res.filter((r) => r.status === 201)).toHaveLength(1);
});
