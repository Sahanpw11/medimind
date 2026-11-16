'use strict';
const router = require('express').Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../db');
const { authenticate } = require('../middleware/auth');

// A user only ever sees notifications addressed to their own user id.
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const db = await getDb(), recipientId = new ObjectId(req.user.id);
    const [data, unread] = await Promise.all([
      db.collection('notifications').find({ recipientId }, { projection: { recipientId: 0 } }).sort({ createdAt: -1 }).limit(10).toArray(),
      db.collection('notifications').countDocuments({ recipientId, status: 'unread' }),
    ]);
    res.json({ data, unread });
  } catch (e) { next(e); }
});

router.post('/read', async (req, res, next) => {
  try {
    const r = await (await getDb()).collection('notifications').updateMany({ recipientId: new ObjectId(req.user.id), status: 'unread' }, { $set: { status: 'read' } });
    res.json({ updated: r.modifiedCount });
  } catch (e) { next(e); }
});

module.exports = router;
