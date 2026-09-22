const fs = require('fs');
const path = require('path');
const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'credentials');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'sample.pdf');
const FIXTURE_TXT = path.join(__dirname, 'fixtures', 'sample.txt');

const validBody = {
  title: 'B.Tech Computer Science',
  issuer: 'JNTU Hyderabad',
  credentialType: 'degree',
  issueDate: '2027-05-30',
};

const create = (token, body = validBody) =>
  request(app).post('/api/credentials').set(auth(token)).send(body);

describe('Credential Management', () => {
  it('creates a credential in pending state', async () => {
    const { token } = await makeUser();
    const res = await create(token);
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.ipfsHash).toBeNull();
    expect(res.body.data.txHash).toBeNull();
  });

  it('requires title, issuer and issueDate', async () => {
    const { token } = await makeUser();
    expect((await create(token, { title: 'Only title' })).status).toBe(400);
  });

  it('rejects an invalid issueDate and a backwards expiryDate', async () => {
    const { token } = await makeUser();
    expect((await create(token, { ...validBody, issueDate: 'not-a-date' })).status).toBe(400);
    expect(
      (await create(token, { ...validBody, issueDate: '2025-01-01', expiryDate: '2024-01-01' }))
        .status
    ).toBe(400);
  });

  it('rejects an unknown credentialType', async () => {
    const { token } = await makeUser();
    const res = await create(token, { ...validBody, credentialType: 'nonsense' });
    expect(res.status).toBe(400);
  });

  it('GET /api/credentials/me lists and filters by status', async () => {
    const { token } = await makeUser();
    await create(token);
    await create(token, { ...validBody, title: 'AWS Cert' });

    const all = await request(app).get('/api/credentials/me').set(auth(token));
    expect(all.body.count).toBe(2);

    const pending = await request(app)
      .get('/api/credentials/me?status=pending')
      .set(auth(token));
    expect(pending.body.count).toBe(2);

    const verified = await request(app)
      .get('/api/credentials/me?status=verified')
      .set(auth(token));
    expect(verified.body.count).toBe(0);
  });

  it('only exposes verified credentials on the public-by-user route', async () => {
    const learner = await makeUser();
    const recruiter = await makeUser({ role: 'employer_recruiter' });
    await create(learner.token);

    const res = await request(app)
      .get(`/api/credentials/user/${learner.user._id}`)
      .set(auth(recruiter.token));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  it('hides a pending credential from an unrelated learner but shows it to the owner', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const cred = (await create(owner.token)).body.data;

    expect(
      (await request(app).get(`/api/credentials/${cred._id}`).set(auth(owner.token))).status
    ).toBe(200);
    expect(
      (await request(app).get(`/api/credentials/${cred._id}`).set(auth(stranger.token))).status
    ).toBe(403);
  });

  it('updates a pending credential but refuses once verified', async () => {
    const owner = await makeUser();
    const admin = await makeAdmin();
    const cred = (await create(owner.token)).body.data;

    const updated = await request(app)
      .put(`/api/credentials/${cred._id}`)
      .set(auth(owner.token))
      .send({ title: 'B.Tech CSE (Honours)' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('B.Tech CSE (Honours)');

    // push it through verification, then try again
    const vr = await request(app)
      .post('/api/verifications')
      .set(auth(owner.token))
      .send({ credentialId: cred._id });
    await request(app)
      .put(`/api/verifications/${vr.body.data._id}/decision`)
      .set(auth(admin.token))
      .send({ decision: 'approved' });

    const blocked = await request(app)
      .put(`/api/credentials/${cred._id}`)
      .set(auth(owner.token))
      .send({ title: 'Sneaky edit' });
    expect(blocked.status).toBe(400);
  });

  it('refuses updates and deletes from a non-owner, but allows an admin delete', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const admin = await makeAdmin();
    const cred = (await create(owner.token)).body.data;

    expect(
      (
        await request(app)
          .put(`/api/credentials/${cred._id}`)
          .set(auth(stranger.token))
          .send({ title: 'Nope' })
      ).status
    ).toBe(403);

    expect(
      (await request(app).delete(`/api/credentials/${cred._id}`).set(auth(stranger.token))).status
    ).toBe(403);

    expect(
      (await request(app).delete(`/api/credentials/${cred._id}`).set(auth(admin.token))).status
    ).toBe(200);
  });

  it('404s for a missing credential', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/api/credentials/64b7f1d2a1b2c3d4e5f60718')
      .set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe('Credential file upload', () => {
  it('stores an uploaded PDF and serves it from /uploads', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/credentials')
      .set(auth(token))
      .field('title', validBody.title)
      .field('issuer', validBody.issuer)
      .field('issueDate', validBody.issueDate)
      .attach('file', FIXTURE_PDF);

    expect(res.status).toBe(201);
    expect(res.body.data.fileUrl).toMatch(/^\/uploads\/credentials\/.+\.pdf$/);

    const onDisk = path.join(UPLOAD_DIR, path.basename(res.body.data.fileUrl));
    expect(fs.existsSync(onDisk)).toBe(true);

    const served = await request(app).get(res.body.data.fileUrl);
    expect(served.status).toBe(200);
  });

  it('rejects a disallowed file type with 400, not 500', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/credentials')
      .set(auth(token))
      .field('title', validBody.title)
      .field('issuer', validBody.issuer)
      .field('issueDate', validBody.issueDate)
      .attach('file', FIXTURE_TXT);

    expect(res.status).toBe(400);
  });

  it('deletes the stored file when the credential is deleted', async () => {
    const { token } = await makeUser();
    const created = await request(app)
      .post('/api/credentials')
      .set(auth(token))
      .field('title', validBody.title)
      .field('issuer', validBody.issuer)
      .field('issueDate', validBody.issueDate)
      .attach('file', FIXTURE_PDF);

    const onDisk = path.join(UPLOAD_DIR, path.basename(created.body.data.fileUrl));
    expect(fs.existsSync(onDisk)).toBe(true);

    await request(app).delete(`/api/credentials/${created.body.data._id}`).set(auth(token));
    await new Promise((r) => setTimeout(r, 150));
    expect(fs.existsSync(onDisk)).toBe(false);
  });
});
