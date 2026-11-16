'use strict';
const router = require('express').Router();
const crypto = require('crypto');
const multer = require('multer');
const { Readable } = require('stream');
const { GridFSBucket } = require('mongodb');
const config = require('../config');
const { getDb } = require('../db');
const { validate, objectIdStr, toOid, pagination, pageMeta, z } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { assertPatientAccess, audit } = require('../services/access');
const { bad, notFound, forbidden } = require('../errors');
const { sniff } = require('../services/files');

router.use(authenticate, requireRole('patient', 'doctor'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

router.post('/', (req, res, next) => upload.single('file')(req, res, (err) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return next(bad(`File too large (max ${config.maxUploadBytes / 1048576}MB)`));
  next(err);
}), async (req, res, next) => {
  try {
    if (!req.file) throw bad('A file is required (multipart field "file")');
    const patientId = req.user.role === 'patient' ? req.user.profileId : req.body.patientId;
    if (!patientId || !/^[a-f\d]{24}$/i.test(patientId)) throw bad('patientId is required');
    const db = await getDb();
    await assertPatientAccess(db, req.user, patientId);
    const mime = sniff(req.file.buffer);
    if (!mime) throw bad('Unsupported file type. Allowed: PDF, PNG, JPEG, plain text');
    if (!['text/plain', mime].includes(mime) || (req.file.mimetype !== mime && !(mime === 'text/plain' && req.file.mimetype.startsWith('text/')))) throw bad('File content does not match its declared type');
    const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    const safeName = req.file.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120);
    const bucket = new GridFSBucket(db, { bucketName: 'documents' });
    const up = bucket.openUploadStream(safeName, { metadata: { patientId: toOid(patientId), mimeType: mime } });
    await new Promise((ok, fail) => Readable.from(req.file.buffer).pipe(up).on('finish', ok).on('error', fail));
    const doc = { patientId: toOid(patientId), uploadedBy: toOid(req.user.id), storageKey: up.id.toString(), filename: safeName, mimeType: mime, size: req.file.size, checksum, uploadedAt: new Date() };
    const r = await db.collection('medical_documents').insertOne(doc);
    await audit(db, req.user, 'upload', 'document', r.insertedId.toString());
    res.status(201).json({ ...doc, _id: r.insertedId });
  } catch (e) { next(e); }
});

router.get('/', validate({ query: pagination.extend({ patientId: objectIdStr.optional() }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const patientId = req.user.role === 'patient' ? req.user.profileId : req.query.patientId;
    if (!patientId) throw bad('patientId is required');
    await assertPatientAccess(db, req.user, patientId);
    const { page, limit } = req.query, filter = { patientId: toOid(patientId) };
    const [data, total] = await Promise.all([
      db.collection('medical_documents').find(filter, { projection: { storageKey: 0 } }).sort({ uploadedAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      db.collection('medical_documents').countDocuments(filter),
    ]);
    res.json({ data, ...pageMeta(page, limit, total) });
  } catch (e) { next(e); }
});

// Controlled retrieval: never a public URL; the stream is only opened after an access check.
router.get('/:id/download', validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const db = await getDb();
    const meta = await db.collection('medical_documents').findOne({ _id: toOid(req.params.id) });
    if (!meta) throw notFound('Document not found');
    await assertPatientAccess(db, req.user, meta.patientId.toString());
    await audit(db, req.user, 'download', 'document', req.params.id);
    res.set({ 'Content-Type': meta.mimeType, 'Content-Disposition': `attachment; filename="${meta.filename}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
    new GridFSBucket(db, { bucketName: 'documents' }).openDownloadStream(toOid(meta.storageKey)).on('error', next).pipe(res);
  } catch (e) { next(e); }
});

// Rename (update) metadata. Only the uploader or the patient who owns the file.
router.put('/:id', validate({ params: z.object({ id: objectIdStr }), body: z.object({ filename: z.string().trim().min(1).max(120) }) }), async (req, res, next) => {
  try {
    const db = await getDb(), meta = await db.collection('medical_documents').findOne({ _id: toOid(req.params.id) });
    if (!meta) throw notFound('Document not found');
    await assertOwnerOrUploader(db, req.user, meta);
    const filename = req.body.filename.replace(/[^\w.\- ]/g, '_');
    await db.collection('medical_documents').updateOne({ _id: meta._id }, { $set: { filename } });
    await db.collection('documents.files').updateOne({ _id: toOid(meta.storageKey) }, { $set: { filename } });
    await audit(db, req.user, 'rename', 'document', req.params.id);
    res.json({ ...meta, filename, storageKey: undefined });
  } catch (e) { next(e); }
});

// Delete the metadata and the stored bytes together.
router.delete('/:id', validate({ params: z.object({ id: objectIdStr }) }), async (req, res, next) => {
  try {
    const db = await getDb(), meta = await db.collection('medical_documents').findOne({ _id: toOid(req.params.id) });
    if (!meta) throw notFound('Document not found');
    await assertOwnerOrUploader(db, req.user, meta);
    await new GridFSBucket(db, { bucketName: 'documents' }).delete(toOid(meta.storageKey)).catch(() => undefined);
    await db.collection('medical_documents').deleteOne({ _id: meta._id });
    await audit(db, req.user, 'delete', 'document', req.params.id);
    res.status(204).end();
  } catch (e) { next(e); }
});

async function assertOwnerOrUploader(db, user, meta) {
  if (String(meta.uploadedBy) === user.id) return;
  if (user.role === 'patient' && String(meta.patientId) === String(user.profileId)) return;
  throw forbidden();
}

module.exports = router;
