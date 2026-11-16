'use strict';
const { MongoClient } = require('mongodb');
const config = require('./config');

// Cache the client promise on globalThis so warm serverless invocations reuse the pool.
function getClient() {
  if (!globalThis.__mmClient) {
    globalThis.__mmClient = new MongoClient(config.mongoUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000 }).connect();
    globalThis.__mmClient.catch(() => { globalThis.__mmClient = null; });
  }
  return globalThis.__mmClient;
}
async function getDb() { return (await getClient()).db(config.dbName); }
module.exports = { getClient, getDb };
