'use strict';
const { connect } = require('./lib');
const { seed } = require('./seed');
(async () => {
  const { client, db } = await connect();
  try { console.table(await seed(db)); } finally { await client.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
