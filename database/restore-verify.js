'use strict';
// Compare the source DB with the restored copy: collection counts, indexes, validators, and sample documents.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { connect, DB_NAME } = require('./lib');
const { ALL } = require('./collections');

const RESTORED = process.env.RESTORE_DB || 'medimind_restore_test';
const OUT = path.join(__dirname, '..', 'docs', 'evidence', 'backup');

(async () => {
  const { client, db } = await connect();
  const rdb = client.db(RESTORED);
  const rows = []; let ok = true;
  try {
    for (const name of [...ALL, 'documents.files', 'documents.chunks']) {
      const [a, b] = await Promise.all([db.collection(name).countDocuments(), rdb.collection(name).countDocuments()]);
      // sample: 5 random docs from source must be deep-equal in the restored DB
      let sampleOk = true;
      for (const d of await db.collection(name).aggregate([{ $sample: { size: 5 } }]).toArray()) {
        const r = await rdb.collection(name).findOne({ _id: d._id });
        try { assert.deepStrictEqual(r, d); } catch { sampleOk = false; }
      }
      const idxA = (await db.collection(name).indexes()).map((i) => i.name).sort().join(','), idxB = (await rdb.collection(name).indexes()).map((i) => i.name).sort().join(',');
      const row = { collection: name, source: a, restored: b, countMatch: a === b, sampleMatch: sampleOk, indexesMatch: idxA === idxB };
      if (!row.countMatch || !row.sampleMatch || !row.indexesMatch) ok = false;
      rows.push(row);
    }
    const vA = (await db.listCollections({ name: 'appointments' }).toArray())[0].options.validator, vB = (await rdb.listCollections({ name: 'appointments' }).toArray())[0].options.validator;
    const validatorMatch = JSON.stringify(vA) === JSON.stringify(vB);
    if (!validatorMatch) ok = false;
    console.table(rows);
    console.log('JSON Schema validator preserved on appointments:', validatorMatch);
    fs.mkdirSync(OUT, { recursive: true });
    const md = ['# Restore verification', '', `Source: \`${DB_NAME}\` → restored copy: \`${RESTORED}\`  ·  verified ${new Date().toISOString()}`, '',
      '| Collection | Source | Restored | Count | 5-doc sample (deep equal) | Indexes |', '|---|---:|---:|:-:|:-:|:-:|',
      ...rows.map((r) => `| ${r.collection} | ${r.source} | ${r.restored} | ${r.countMatch ? 'match' : 'MISMATCH'} | ${r.sampleMatch ? 'match' : 'MISMATCH'} | ${r.indexesMatch ? 'match' : 'MISMATCH'} |`),
      '', `JSON Schema validator on \`appointments\` preserved: **${validatorMatch}**`, '', `Overall: **${ok ? 'PASS' : 'FAIL'}**`, ''].join('\n');
    fs.writeFileSync(path.join(OUT, 'restore-verification.md'), md);
    if (!ok) process.exitCode = 1;
  } finally { await client.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
