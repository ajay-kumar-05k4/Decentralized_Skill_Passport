// Jest bootstrap.
//
// By default the suite spins up an in-memory MongoDB so it never touches your
// real database. If you'd rather run against a MongoDB you already have
// (local mongod, Docker, or an Atlas test cluster), set TEST_MONGO_URI:
//
//   TEST_MONGO_URI="mongodb://127.0.0.1:27017/dsp-test" npm test
//
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest-only';
process.env.JWT_EXPIRES_IN = '1h';
// The public verification desk is rate limited; that would make the suite
// flaky, so it is switched off here and ONLY here.
process.env.DISABLE_RATE_LIMIT = 'true';

const mongoose = require('mongoose');

let memoryServer;

beforeAll(async () => {
  let uri = process.env.TEST_MONGO_URI;

  if (!uri) {
    // Lazy require so the dependency is only needed when it is actually used
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
  if (memoryServer) await memoryServer.stop();
});
