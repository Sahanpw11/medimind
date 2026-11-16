'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { ObjectId } = require('mongodb');
const config = require('../config');
const { getDb, getClient } = require('../db');
const { validate, z } = require('../middleware/validate');
const { authenticate, setSession, clearSession, jwt } = require('../middleware/auth');
const { unauthorized, conflict } = require('../errors');

const limiter = config.isTest ? (_q, _r, n) => n() : rateLimit({ windowMs: 60_000, limit: Number(process.env.AUTH_RATE_LIMIT || 20), standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts, try again shortly' } });

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128).regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number'),
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date().refine((d) => d < new Date() && d > new Date('1900-01-01'), 'Invalid date of birth'),
}); // "role" (or anything else) in the body is stripped: roles are never client-authoritative

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

async function profileIdFor(db, user) {
  if (user.role === 'admin') return null;
  const coll = user.role === 'patient' ? 'patients' : 'doctors';
  const p = await db.collection(coll).findOne({ userId: user._id }, { projection: { _id: 1 } });
  return p ? p._id.toString() : null;
}
const publicUser = (u, profileId) => ({ id: u._id.toString(), email: u.email, role: u.role, profileId });

router.post('/register', limiter, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const db = await getDb();
    const { email, password, fullName, dateOfBirth } = req.body;
    const now = new Date();
    const user = { _id: new ObjectId(), email, passwordHash: await bcrypt.hash(password, 12), role: 'patient', status: 'active', createdAt: now };
    const patient = { _id: new ObjectId(), userId: user._id, fullName, dateOfBirth, contact: { email }, address: {}, allergies: [], emergencyContact: { name: 'Not provided', relationship: 'Unknown' }, onboardingDone: false, createdAt: now };
    const session = (await getClient()).startSession();
    try {
      await session.withTransaction(async () => {
        await db.collection('users').insertOne(user, { session });
        await db.collection('patients').insertOne(patient, { session });
      });
    } catch (e) {
      if (e.code === 11000) throw conflict('An account with this email already exists');
      throw e;
    } finally { await session.endSession(); }
    const out = publicUser(user, patient._id.toString());
    setSession(res, out);
    res.status(201).json({ user: out });
  } catch (e) { next(e); }
});

router.post('/login', limiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.collection('users').findOne({ email: req.body.email });
    // Compare against a dummy hash when the user is missing, to keep timing uniform.
    const ok = await bcrypt.compare(req.body.password, user ? user.passwordHash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    if (!user || !ok || user.status !== 'active') throw unauthorized('Invalid email or password');
    const out = publicUser(user, await profileIdFor(db, user));
    setSession(res, out);
    res.json({ user: out });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.mm_rt;
    if (!token) throw unauthorized();
    let p; try { p = jwt.verify(token, config.jwtRefreshSecret); } catch { throw unauthorized('Session expired'); }
    if (p.typ !== 'refresh') throw unauthorized();
    const db = await getDb();
    const user = await db.collection('users').findOne({ _id: new ObjectId(p.sub) });
    if (!user || user.status !== 'active') throw unauthorized();
    const out = publicUser(user, await profileIdFor(db, user));
    setSession(res, out);
    res.json({ user: out });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => { clearSession(res); res.status(204).end(); });

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = await getDb();
    const u = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!u || u.status !== 'active') throw unauthorized();
    res.json({ user: publicUser(u, req.user.profileId || null) });
  } catch (e) { next(e); }
});

module.exports = router;
