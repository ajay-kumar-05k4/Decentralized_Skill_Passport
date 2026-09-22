const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

const credentialBody = {
  title: 'Full Stack Web Development',
  issuer: 'NPTEL',
  credentialType: 'certificate',
  issueDate: '2026-01-15',
};

const setup = async () => {
  const learner = await makeUser();
  const institution = await makeUser({ role: 'educational_institution' });
  const cred = (
    await request(app).post('/api/credentials').set(auth(learner.token)).send(credentialBody)
  ).body.data;
  return { learner, institution, cred };
};

describe('Credential Verification workflow', () => {
  it('runs the full happy path: request -> claim -> approve -> credential verified', async () => {
    const { learner, institution, cred } = await setup();

    const requested = await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });
    expect(requested.status).toBe(201);
    expect(requested.body.data.status).toBe('pending');

    const queue = await request(app).get('/api/verifications').set(auth(institution.token));
    expect(queue.body.count).toBe(1);
    expect(queue.body.data[0].requestedBy.email).toBe(learner.user.email);

    const claimed = await request(app)
      .put(`/api/verifications/${requested.body.data._id}/claim`)
      .set(auth(institution.token));
    expect(claimed.status).toBe(200);
    expect(claimed.body.data.status).toBe('in_review');

    const decided = await request(app)
      .put(`/api/verifications/${requested.body.data._id}/decision`)
      .set(auth(institution.token))
      .send({ decision: 'approved', comments: 'Verified against the issuer portal' });
    expect(decided.status).toBe(200);
    expect(decided.body.data.request.status).toBe('approved');
    expect(decided.body.data.credential.status).toBe('verified');

    const mine = await request(app).get('/api/credentials/me').set(auth(learner.token));
    expect(mine.body.data[0].status).toBe('verified');
  });

  it('rejection marks the credential rejected and allows a re-submission', async () => {
    const { learner, institution, cred } = await setup();

    const first = await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });

    await request(app)
      .put(`/api/verifications/${first.body.data._id}/decision`)
      .set(auth(institution.token))
      .send({ decision: 'rejected', comments: 'Issuer could not be confirmed' });

    const afterReject = await request(app)
      .get(`/api/credentials/${cred._id}`)
      .set(auth(learner.token));
    expect(afterReject.body.data.status).toBe('rejected');

    const resubmit = await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });
    expect(resubmit.status).toBe(201);
  });

  it('GET /api/verifications/me shows only the caller own requests', async () => {
    const { learner, cred } = await setup();
    const other = await setup();

    await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });
    await request(app)
      .post('/api/verifications')
      .set(auth(other.learner.token))
      .send({ credentialId: other.cred._id });

    const mine = await request(app).get('/api/verifications/me').set(auth(learner.token));
    expect(mine.body.count).toBe(1);
  });

  it('blocks a duplicate in-flight request for the same credential', async () => {
    const { learner, cred } = await setup();
    await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });

    const dup = await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });
    expect(dup.status).toBe(400);
  });

  it('refuses a request for a credential the caller does not own', async () => {
    const { cred } = await setup();
    const stranger = await makeUser();
    const res = await request(app)
      .post('/api/verifications')
      .set(auth(stranger.token))
      .send({ credentialId: cred._id });
    expect(res.status).toBe(403);
  });

  it('validates the request body', async () => {
    const { learner } = await setup();
    expect(
      (await request(app).post('/api/verifications').set(auth(learner.token)).send({})).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/verifications')
          .set(auth(learner.token))
          .send({ credentialId: '64b7f1d2a1b2c3d4e5f60718' })
      ).status
    ).toBe(404);
  });

  it('a learner cannot see the queue, claim, or decide', async () => {
    const { learner, cred } = await setup();
    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    expect((await request(app).get('/api/verifications').set(auth(learner.token))).status).toBe(403);
    expect(
      (await request(app).put(`/api/verifications/${req._id}/claim`).set(auth(learner.token))).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/verifications/${req._id}/decision`)
          .set(auth(learner.token))
          .send({ decision: 'approved' })
      ).status
    ).toBe(403);
  });

  it('a mentor who also owns the credential cannot self-approve', async () => {
    const mentor = await makeUser({ role: 'mentor_industry_expert' });
    const cred = (
      await request(app).post('/api/credentials').set(auth(mentor.token)).send(credentialBody)
    ).body.data;
    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(mentor.token))
        .send({ credentialId: cred._id })
    ).body.data;

    const res = await request(app)
      .put(`/api/verifications/${req._id}/decision`)
      .set(auth(mentor.token))
      .send({ decision: 'approved' });
    expect(res.status).toBe(403);
  });

  it('a second verifier cannot decide a request another verifier claimed', async () => {
    const { learner, institution, cred } = await setup();
    const mentor = await makeUser({ role: 'mentor_industry_expert' });

    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    await request(app).put(`/api/verifications/${req._id}/claim`).set(auth(institution.token));

    const res = await request(app)
      .put(`/api/verifications/${req._id}/decision`)
      .set(auth(mentor.token))
      .send({ decision: 'approved' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid decision value and a double decision', async () => {
    const { learner, institution, cred } = await setup();
    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    expect(
      (
        await request(app)
          .put(`/api/verifications/${req._id}/decision`)
          .set(auth(institution.token))
          .send({ decision: 'maybe' })
      ).status
    ).toBe(400);

    await request(app)
      .put(`/api/verifications/${req._id}/decision`)
      .set(auth(institution.token))
      .send({ decision: 'approved' });

    const again = await request(app)
      .put(`/api/verifications/${req._id}/decision`)
      .set(auth(institution.token))
      .send({ decision: 'rejected' });
    expect(again.status).toBe(400);
  });

  it('only pending requests can be claimed', async () => {
    const { learner, institution, cred } = await setup();
    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    await request(app).put(`/api/verifications/${req._id}/claim`).set(auth(institution.token));
    const again = await request(app)
      .put(`/api/verifications/${req._id}/claim`)
      .set(auth(institution.token));
    expect(again.status).toBe(400);
  });

  it('refuses to re-verify an already verified credential', async () => {
    const admin = await makeAdmin();
    const { learner, cred } = await setup();
    const req = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    await request(app)
      .put(`/api/verifications/${req._id}/decision`)
      .set(auth(admin.token))
      .send({ decision: 'approved' });

    const res = await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });
    expect(res.status).toBe(400);
  });

  it('filters the queue by status', async () => {
    const { learner, institution, cred } = await setup();
    await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });

    const pending = await request(app)
      .get('/api/verifications?status=pending')
      .set(auth(institution.token));
    expect(pending.body.count).toBe(1);

    const approved = await request(app)
      .get('/api/verifications?status=approved')
      .set(auth(institution.token));
    expect(approved.body.count).toBe(0);
  });
});
