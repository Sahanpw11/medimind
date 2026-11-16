'use strict';
const validators = require('./validators');
const { ensureIndexes } = require('./indexes');

const ALL = ['users', 'patients', 'doctors', 'appointments', 'slot_reservations', 'medical_records',
  'medical_documents', 'ai_conversations', 'ai_messages', 'notifications', 'audit_logs'];

async function ensureCollections(db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of ALL) {
    const validator = validators[name] ? { $jsonSchema: validators[name] } : undefined;
    if (!existing.has(name)) {
      await db.createCollection(name, validator ? { validator, validationLevel: 'strict', validationAction: 'error' } : {});
    } else if (validator) {
      await db.command({ collMod: name, validator, validationLevel: 'strict', validationAction: 'error' });
    }
  }
  await ensureIndexes(db);
}

module.exports = { ensureCollections, ALL };
