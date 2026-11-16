process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true';
process.env.MONGODB_DB = 'medimind_test'; // never touch the dev database
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.AI_SERVICE_URL = 'http://127.0.0.1:9'; // closed port => exercises the fallback path
process.env.AI_SERVICE_SECRET = 'test-internal';
process.env.AI_TIMEOUT_MS = '1500';
