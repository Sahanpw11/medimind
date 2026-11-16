'use strict';
const router = require('express').Router();
const config = require('../config');
const { getDb } = require('../db');
const { validate, toOid, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { bad } = require('../errors');

router.use(authenticate);
const DISCLAIMER = 'Educational information only. This is not medical advice and does not diagnose or treat conditions.';
const EMERGENCY = 'If you think this may be an emergency, call your local emergency number (1990 in Sri Lanka) or go to the nearest hospital immediately.';

async function callAi(path, payload) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), config.aiTimeoutMs);
  try {
    const r = await fetch(config.aiUrl + path, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': config.aiSecret }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('AI service responded ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

const chatSchema = z.object({ question: z.string().trim().min(2).max(500), sessionId: z.string().regex(/^[\w-]{1,64}$/).default('default') });

router.post('/chat', requireRole('patient'), validate({ body: chatSchema }), async (req, res, next) => {
  try {
    const db = await getDb(), now = new Date(), patientId = toOid(req.user.profileId);
    const conv = await db.collection('ai_conversations').findOneAndUpdate(
      { patientId, sessionId: req.body.sessionId }, { $setOnInsert: { patientId, sessionId: req.body.sessionId, messageCount: 0, createdAt: now, title: req.body.question.slice(0, 60) } }, { upsert: true, returnDocument: 'after' });
    if (conv.messageCount >= config.maxConversationMessages) throw bad('This conversation is full. Please start a new session.');

    let out, degraded = false;
    try {
      // Only the question and an opaque session id leave this service: no identifiers or clinical data.
      out = await callAi('/ai/chat', { question: req.body.question, sessionId: conv._id.toString() });
    } catch {
      degraded = true;
      out = { answer: 'The educational assistant is temporarily unavailable. Please try again shortly, or speak with your doctor.', sources: [], disclaimer: DISCLAIMER, emergency: EMERGENCY, mode: 'unavailable' };
    }
    await db.collection('ai_messages').insertMany([
      { conversationId: conv._id, role: 'user', content: req.body.question, createdAt: now },
      { conversationId: conv._id, role: 'assistant', content: out.answer, sources: out.sources || [], degraded, createdAt: new Date() },
    ]);
    await db.collection('ai_conversations').updateOne({ _id: conv._id }, { $inc: { messageCount: 2 }, $set: { updatedAt: new Date() } });
    res.json({ answer: out.answer, sources: out.sources || [], disclaimer: out.disclaimer || DISCLAIMER, emergency: out.emergency ?? EMERGENCY, mode: out.mode || 'answer', degraded });
  } catch (e) { next(e); }
});

router.get('/history', requireRole('patient'), validate({ query: z.object({ sessionId: z.string().regex(/^[\w-]{1,64}$/).default('default') }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const conv = await db.collection('ai_conversations').findOne({ patientId: toOid(req.user.profileId), sessionId: req.query.sessionId });
    if (!conv) return res.json({ data: [] });
    res.json({ data: await db.collection('ai_messages').find({ conversationId: conv._id }, { projection: { content: 1, role: 1, sources: 1, degraded: 1, createdAt: 1 } }).sort({ createdAt: 1 }).limit(config.maxConversationMessages).toArray() });
  } catch (e) { next(e); }
});

// Past chats for the signed-in patient, newest first. Title = first question (stored on new chats, derived for older ones).
router.get('/conversations', requireRole('patient'), async (req, res, next) => {
  try {
    const db = await getDb();
    const data = await db.collection('ai_conversations').aggregate([
      { $match: { patientId: toOid(req.user.profileId), messageCount: { $gt: 0 } } },
      { $addFields: { last: { $ifNull: ['$updatedAt', '$createdAt'] } } },
      { $sort: { last: -1 } }, { $limit: 30 },
      { $lookup: { from: 'ai_messages', let: { id: '$_id' }, as: 'first', pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$conversationId', '$$id'] }, { $eq: ['$role', 'user'] }] } } }, { $sort: { createdAt: 1 } }, { $limit: 1 }, { $project: { content: 1 } }] } },
      { $project: { _id: 0, sessionId: 1, messageCount: 1, updatedAt: '$last', title: { $ifNull: ['$title', { $substrCP: [{ $ifNull: [{ $arrayElemAt: ['$first.content', 0] }, 'New chat'] }, 0, 60] }] } } },
    ]).toArray();
    res.json({ data });
  } catch (e) { next(e); }
});

router.delete('/conversations/:sessionId', requireRole('patient'), validate({ params: z.object({ sessionId: z.string().regex(/^[\w-]{1,64}$/) }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const conv = await db.collection('ai_conversations').findOne({ patientId: toOid(req.user.profileId), sessionId: req.params.sessionId });
    if (!conv) return res.status(404).json({ error: 'Chat not found' });
    await db.collection('ai_messages').deleteMany({ conversationId: conv._id });
    await db.collection('ai_conversations').deleteOne({ _id: conv._id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Doctors/admins: no-show risk for an upcoming appointment (features contain no identifiers).
router.post('/no-show-risk', requireRole('doctor', 'admin'), validate({ body: z.object({ appointmentId: z.string().regex(/^[a-f\d]{24}$/i) }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const a = await db.collection('appointments').findOne({ _id: toOid(req.body.appointmentId) });
    if (!a || (req.user.role === 'doctor' && String(a.doctorId) !== req.user.profileId)) return res.status(404).json({ error: 'Appointment not found' });
    const prior = await db.collection('appointments').countDocuments({ patientId: a.patientId, status: 'no_show', startAt: { $lt: a.startAt } });
    const leadTimeDays = Math.max(0, Math.round((a.startAt - a.createdAt) / 864e5));
    try {
      res.json(await callAi('/predict/no-show', { leadTimeDays, priorMissedVisits: prior, weekday: a.startAt.getUTCDay(), online: a.consultationType === 'online' }));
    } catch { res.status(503).json({ error: 'Prediction service unavailable', degraded: true }); }
  } catch (e) { next(e); }
});

module.exports = router;
