const { app, request, makeUser, auth } = require('./helpers');

describe('Health & stubbed layers', () => {
  it('GET /api/health reports the API and DB status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toBe('connected');
  });

  it('returns 501 for the not-yet-built blockchain layer', async () => {
    const res = await request(app).get('/api/blockchain/anything');
    expect(res.status).toBe(501);
  });

  it('returns 501 for the not-yet-built AI layer', async () => {
    const res = await request(app).get('/api/ai/anything');
    expect(res.status).toBe(501);
  });

  it('returns 404 for an unknown route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/register', () => {
  it('creates a user, hashes the password and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.data.role).toBe('learner');
    expect(res.body.data.password).toBeUndefined();
  });

  it('creates an empty profile shell alongside the user', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/api/profiles/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.skills).toEqual([]);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'x@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    const { user, password } = await makeUser();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: user.email, password });
    expect(res.status).toBe(400);
  });

  it('refuses to hand out the administrator role at registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Sneaky',
      email: 'sneaky@example.com',
      password: 'password123',
      role: 'administrator',
    });
    expect(res.status).toBe(400);
  });

  it('accepts the other stakeholder roles', async () => {
    for (const role of [
      'educational_institution',
      'employer_recruiter',
      'mentor_industry_expert',
    ]) {
      const { user } = await makeUser({ role });
      expect(user.role).toBe(role);
    }
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials', async () => {
    const { user, password } = await makeUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects a wrong password', async () => {
    const { user } = await makeUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });
});

describe('Protected route behaviour', () => {
  it('GET /api/auth/me returns the logged-in user', async () => {
    const { user, token } = await makeUser();
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('rejects a request with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set(auth('garbage.token.value'));
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/auth/change-password', () => {
  it('changes the password and lets the user log in with the new one', async () => {
    const { user, token, password } = await makeUser();

    const res = await request(app)
      .put('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: password, newPassword: 'brandnew456' });
    expect(res.status).toBe(200);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'brandnew456' });
    expect(relogin.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: 'nope', newPassword: 'brandnew456' });
    expect(res.status).toBe(401);
  });

  it('rejects a too-short new password', async () => {
    const { token, password } = await makeUser();
    const res = await request(app)
      .put('/api/auth/change-password')
      .set(auth(token))
      .send({ currentPassword: password, newPassword: '123' });
    expect(res.status).toBe(400);
  });
});
