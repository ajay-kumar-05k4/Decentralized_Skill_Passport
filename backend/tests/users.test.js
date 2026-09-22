const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

describe('User & Role Management', () => {
  it('GET /api/users/roles/list returns the five stakeholder roles', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/api/users/roles/list').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      'learner',
      'educational_institution',
      'employer_recruiter',
      'mentor_industry_expert',
      'administrator',
    ]);
  });

  it('PUT /api/users/me updates the caller-owned fields', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/api/users/me')
      .set(auth(token))
      .send({ name: 'Updated Name', organization: 'IIT Hyderabad' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
    expect(res.body.data.organization).toBe('IIT Hyderabad');
  });

  it('a learner cannot list all users', async () => {
    const { token } = await makeUser();
    const res = await request(app).get('/api/users').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('an administrator can list, filter and paginate users', async () => {
    const admin = await makeAdmin();
    await makeUser({ role: 'employer_recruiter' });
    await makeUser();

    const all = await request(app).get('/api/users').set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThanOrEqual(3);

    const filtered = await request(app)
      .get('/api/users?role=employer_recruiter')
      .set(auth(admin.token));
    expect(filtered.body.data.every((u) => u.role === 'employer_recruiter')).toBe(true);

    const paged = await request(app).get('/api/users?page=1&limit=1').set(auth(admin.token));
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.page).toBe(1);
  });

  it('an administrator can fetch a single user and change their role', async () => {
    const admin = await makeAdmin();
    const { user } = await makeUser();

    const fetched = await request(app).get(`/api/users/${user._id}`).set(auth(admin.token));
    expect(fetched.status).toBe(200);

    const updated = await request(app)
      .put(`/api/users/${user._id}`)
      .set(auth(admin.token))
      .send({ role: 'mentor_industry_expert' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.role).toBe('mentor_industry_expert');
  });

  it('rejects an invalid role on update', async () => {
    const admin = await makeAdmin();
    const { user } = await makeUser();
    const res = await request(app)
      .put(`/api/users/${user._id}`)
      .set(auth(admin.token))
      .send({ role: 'supreme_leader' });
    expect(res.status).toBe(400);
  });

  it('a deactivated user can no longer log in or use their token', async () => {
    const admin = await makeAdmin();
    const { user, token, password } = await makeUser();

    await request(app)
      .put(`/api/users/${user._id}`)
      .set(auth(admin.token))
      .send({ isActive: false });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password });
    expect(login.status).toBe(403);

    const withOldToken = await request(app).get('/api/auth/me').set(auth(token));
    expect(withOldToken.status).toBe(403);
  });

  it('refuses to demote the last active administrator', async () => {
    const admin = await makeAdmin();
    const res = await request(app)
      .put(`/api/users/${admin.user._id}`)
      .set(auth(admin.token))
      .send({ role: 'learner' });
    expect(res.status).toBe(400);
  });

  it('deleting a user cascades to their profile, credentials and requests', async () => {
    const Profile = require('../models/Profile');
    const Credential = require('../models/Credential');
    const VerificationRequest = require('../models/VerificationRequest');

    const admin = await makeAdmin();
    const learner = await makeUser();

    const cred = await request(app)
      .post('/api/credentials')
      .set(auth(learner.token))
      .send({ title: 'B.Tech CSE', issuer: 'JNTUH', issueDate: '2023-06-01' });
    await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred.body.data._id });

    const res = await request(app)
      .delete(`/api/users/${learner.user._id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(200);

    expect(await Profile.countDocuments({ user: learner.user._id })).toBe(0);
    expect(await Credential.countDocuments({ user: learner.user._id })).toBe(0);
    expect(await VerificationRequest.countDocuments({ requestedBy: learner.user._id })).toBe(0);
  });

  it('an administrator cannot delete their own account', async () => {
    const admin = await makeAdmin();
    const res = await request(app)
      .delete(`/api/users/${admin.user._id}`)
      .set(auth(admin.token));
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent user id', async () => {
    const admin = await makeAdmin();
    const res = await request(app)
      .get('/api/users/64b7f1d2a1b2c3d4e5f60718')
      .set(auth(admin.token));
    expect(res.status).toBe(404);
  });
});
