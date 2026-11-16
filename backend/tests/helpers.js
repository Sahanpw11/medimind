'use strict';
const jwt = require('jsonwebtoken');
const { connect, oid } = require('../../database/lib');
const { seed } = require('../../database/seed');

let ctx;
async function setup() {
  if (ctx) return ctx;
  const { client, db } = await connect();
  await seed(db, { anchor: new Date().toISOString().slice(0, 10) });
  ctx = { client, db, app: require('../src/app') };
  return ctx;
}
async function teardown() { if (ctx) { await ctx.client.close(); await (await globalThis.__mmClient)?.close(); ctx = null; globalThis.__mmClient = null; } }

// Mint tokens directly (same secret the app verifies with) to avoid bcrypt cost in every test.
const tokenFor = (role, profileId, userId) => 'Bearer ' + jwt.sign({ sub: String(userId), role, pid: profileId ? String(profileId) : undefined }, process.env.JWT_SECRET, { expiresIn: '15m' });
const patientAuth = (n) => tokenFor('patient', oid('patient', n), oid('user', 1000 + n));
const doctorAuth = (n) => tokenFor('doctor', oid('doctor', n), oid('user', n));
const adminAuth = () => tokenFor('admin', null, oid('user', 0));

// A Monday-Friday 10:00 UTC slot far enough out to be beyond all seeded appointments.
function freeSlot(offsetDays = 170, hour = 10) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour));
}
module.exports = { setup, teardown, patientAuth, doctorAuth, adminAuth, tokenFor, freeSlot, oid };
