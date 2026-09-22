const { app, request, makeUser, makeAdmin, auth } = require('./helpers');
const { buildIdentityHash, sha256 } = require('../utils/hash');

const ID_NUMBER = '5555-4444-3333';
const PHRASE = 'linkage-secret-phrase';

// Builds a learner with a registered identity and a VERIFIED credential
const buildVerifiedLearner = async () => {
  const admin = await makeAdmin();
  const learner = await makeUser();

  await request(app)
    .post('/api/identity/me')
    .set(auth(learner.token))
    .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

  const cred = (
    await request(app).post('/api/credentials').set(auth(learner.token)).send({
      title: 'B.Tech Computer Science',
      issuer: 'CVR College of Engineering',
      credentialType: 'degree',
      issueDate: '2027-05-30',
    })
  ).body.data;

  const vr = await request(app)
    .post('/api/verifications')
    .set(auth(learner.token))
    .send({ credentialId: cred._id });
  await request(app)
    .put(`/api/verifications/${vr.body.data._id}/decision`)
    .set(auth(admin.token))
    .send({ decision: 'approved' });

  const fresh = (
    await request(app).get(`/api/credentials/${cred._id}`).set(auth(learner.token))
  ).body.data;

  return {
    admin,
    learner,
    credential: fresh,
    identityHash: buildIdentityHash(ID_NUMBER, PHRASE),
  };
};

describe('Credential hashing', () => {
  it('assigns a SHA-256 hash to every credential on creation', async () => {
    const { token } = await makeUser();
    const res = await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'NPTEL Full Stack',
      issuer: 'NPTEL',
      issueDate: '2026-01-15',
    });
    expect(res.body.data.credentialHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes the file bytes when a document is uploaded', async () => {
    const fs = require('fs');
    const path = require('path');
    const fixture = path.join(__dirname, 'fixtures', 'sample.pdf');
    const expected = sha256(fs.readFileSync(fixture));

    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/credentials')
      .set(auth(token))
      .field('title', 'Uploaded Cert')
      .field('issuer', 'Coursera')
      .field('issueDate', '2026-02-01')
      .attach('file', fixture);

    // sha256() stringifies its input, so compare against the crypto digest
    const crypto = require('crypto');
    const fileDigest = crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
    expect(res.body.data.credentialHash).toBe(fileDigest);
    expect(expected).toBeDefined();
  });

  it('two different credentials get different hashes', async () => {
    const { token } = await makeUser();
    const a = await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'Cert A', issuer: 'Issuer A', issueDate: '2026-01-01',
    });
    const b = await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'Cert B', issuer: 'Issuer B', issueDate: '2026-01-01',
    });
    expect(a.body.data.credentialHash).not.toBe(b.body.data.credentialHash);
  });
});

describe('Public verification desk (no authentication)', () => {
  it('step 1: confirms a registered identity', async () => {
    const { identityHash, learner } = await buildVerifiedLearner();
    const res = await request(app).post('/api/verify/identity').send({ identityHash });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.holderName).toBe(learner.user.name);
  });

  it('step 1: rejects an unknown identity without leaking anything', async () => {
    await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/identity')
      .send({ identityHash: sha256('not-a-real-identity') });

    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.holderName).toBeNull();
  });

  it('step 2: confirms a verified credential and reports its metadata', async () => {
    const { credential } = await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/credential')
      .send({ credentialHash: credential.credentialHash });

    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.issuer).toBe('CVR College of Engineering');
  });

  it('step 2: a pending credential is found but not valid', async () => {
    const { token } = await makeUser();
    const cred = (
      await request(app).post('/api/credentials').set(auth(token)).send({
        title: 'Unverified Cert', issuer: 'Somewhere', issueDate: '2026-01-01',
      })
    ).body.data;

    const res = await request(app)
      .post('/api/verify/credential')
      .send({ credentialHash: cred.credentialHash });

    expect(res.body.data.found).toBe(true);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.title).toBeNull();
  });

  it('step 3: confirms the credential belongs to that identity', async () => {
    const { identityHash, credential } = await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/linkage')
      .send({ identityHash, credentialHash: credential.credentialHash });

    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.linked).toBe(true);
  });

  it('step 3: a real identity plus a real credential that are NOT linked fails', async () => {
    const { credential } = await buildVerifiedLearner();

    // A second, genuine learner with their own genuine identity
    const impostor = await makeUser();
    await request(app)
      .post('/api/identity/me')
      .set(auth(impostor.token))
      .send({ uniqueIdNumber: '1111-2222-3333', secretPhrase: 'impostor-secret-phrase' });
    const impostorHash = buildIdentityHash('1111-2222-3333', 'impostor-secret-phrase');

    const res = await request(app)
      .post('/api/verify/linkage')
      .send({ identityHash: impostorHash, credentialHash: credential.credentialHash });

    // Both halves are individually genuine - only the linkage check catches this
    expect(res.body.data.identityValid).toBe(true);
    expect(res.body.data.credentialValid).toBe(true);
    expect(res.body.data.linked).toBe(false);
    expect(res.body.data.valid).toBe(false);
  });

  it('full check passes for a genuine holder and credential', async () => {
    const { identityHash, credential, learner } = await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/full')
      .send({ identityHash, credentialHash: credential.credentialHash });

    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.checks).toEqual({ identity: true, credential: true, linkage: true });
    expect(res.body.data.holderName).toBe(learner.user.name);
    expect(res.body.data.credential.title).toBe('B.Tech Computer Science');
  });

  it('full check fails and pinpoints the failing step', async () => {
    const { credential } = await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/full')
      .send({ identityHash: sha256('ghost'), credentialHash: credential.credentialHash });

    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.checks.identity).toBe(false);
    expect(res.body.data.checks.credential).toBe(true);
    expect(res.body.data.holderName).toBeNull();
  });

  it('a deactivated holder stops verifying', async () => {
    const { identityHash, admin, learner } = await buildVerifiedLearner();
    await request(app)
      .put(`/api/users/${learner.user._id}`)
      .set(auth(admin.token))
      .send({ isActive: false });

    const res = await request(app).post('/api/verify/identity').send({ identityHash });
    expect(res.body.data.valid).toBe(false);
  });

  it('rejects malformed hashes with 400', async () => {
    expect((await request(app).post('/api/verify/identity').send({})).status).toBe(400);
    expect(
      (await request(app).post('/api/verify/identity').send({ identityHash: 'nope' })).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/verify/linkage')
          .send({ identityHash: sha256('a') })
      ).status
    ).toBe(400);
  });

  it('works with no Authorization header at all', async () => {
    const { identityHash, credential } = await buildVerifiedLearner();
    const res = await request(app)
      .post('/api/verify/full')
      .send({ identityHash, credentialHash: credential.credentialHash });
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
  });
});
