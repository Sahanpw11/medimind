'use strict';
const isProd = process.env.NODE_ENV === 'production';
function need(name, devDefault) {
  const v = process.env[name];
  if (v) return v;
  if (isProd) throw new Error(`Missing required env var ${name}`);
  return devDefault;
}
module.exports = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  mongoUri: need('MONGODB_URI', 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true'),
  dbName: process.env.MONGODB_DB || 'medimind_db',
  jwtSecret: need('JWT_SECRET', 'dev-only-secret'),
  jwtRefreshSecret: need('JWT_REFRESH_SECRET', 'dev-only-refresh-secret'),
  aiUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
  aiSecret: need('AI_SERVICE_SECRET', 'dev-internal-secret'),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 5000),
  slotMinutes: 30,
  maxBookingDaysAhead: 180,
  maxUploadBytes: 4 * 1024 * 1024, // keeps uploads small; files are stored in MongoDB GridFS
  maxConversationMessages: 200,
};
