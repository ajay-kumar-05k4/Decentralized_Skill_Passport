const request = require('supertest');
const app = require('../app');

let counter = 0;

// Registers a user through the real endpoint and returns { user, token, agent }
async function makeUser(overrides = {}) {
  counter += 1;
  const payload = {
    name: overrides.name || `User ${counter}`,
    email: overrides.email || `user${counter}.${Date.now()}@example.com`,
    password: overrides.password || 'password123',
    ...(overrides.role ? { role: overrides.role } : {}),
    ...(overrides.organization ? { organization: overrides.organization } : {}),
  };

  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status !== 201) {
    throw new Error(`makeUser failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return { user: res.body.data, token: res.body.token, password: payload.password };
}

// Promotes a user directly in the DB - used to create the first administrator,
// since the public register endpoint refuses the administrator role.
async function makeAdmin() {
  const User = require('../models/User');
  const generateToken = require('../utils/generateToken');
  const { user } = await makeUser();
  await User.updateOne({ _id: user._id }, { $set: { role: 'administrator' } });
  return { user: { ...user, role: 'administrator' }, token: generateToken(user._id, 'administrator') };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, makeUser, makeAdmin, auth };
