'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'medimind_db';

async function connect(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is not set (see .env.example)');
  const client = new MongoClient(uri, { maxPoolSize: 20 });
  await client.connect();
  return { client, db: client.db(DB_NAME) };
}

// Deterministic ObjectIds: 2-hex kind prefix + zero padded counter.
const KIND = { user: '01', patient: '02', doctor: '03', appointment: '04', record: '05', notification: '06' };
function oid(kind, n) {
  return new ObjectId(KIND[kind] + n.toString(16).padStart(22, '0'));
}

module.exports = { connect, oid, ObjectId, DB_NAME };
