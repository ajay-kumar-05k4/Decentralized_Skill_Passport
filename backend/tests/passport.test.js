const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

const seedLearner = async () => {
  const admin = await makeAdmin();
  const learner = await makeUser({ name: 'Ajay Kumar' });

  const skill = (
    await request(app).post('/api/skills').set(auth(admin.token)).send({ name: 'React.js', category: 'frontend' })
  ).body.data;

  await request(app)
    .post('/api/profiles/me/skills')
    .set(auth(learner.token))
    .send({ skillId: skill._id, proficiency: 'advanced' });

  await request(app)
    .put('/api/profiles/me')
    .set(auth(learner.token))
    .send({
      headline: 'Full stack + web3',
      location: 'Hyderabad',
      projects: [{ title: 'SkillPass', role: 'Backend lead', technologies: ['Node.js', 'MongoDB'] }],
      internships: [{ organization: 'Acme', role: 'SDE Intern' }],
      research: [{ title: 'Blockchain credential verification', venue: 'ICESC', year: 2026 }],
    });

  const cred = (
    await request(app).post('/api/credentials').set(auth(learner.token)).send({
      title: 'B.Tech CSE', issuer: 'CVR College', credentialType: 'degree', issueDate: '2027-05-30',
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

  return { admin, learner, skill };
};

describe('Digital Skill Passport', () => {
  it('assembles skills, credentials, projects, internships and research', async () => {
    const { learner } = await seedLearner();
    const res = await request(app).get('/api/passport/me').set(auth(learner.token));

    expect(res.status).toBe(200);
    const p = res.body.data;
    expect(p.holder.name).toBe('Ajay Kumar');
    expect(p.holder.headline).toBe('Full stack + web3');
    expect(p.skills[0]).toMatchObject({ name: 'React.js', proficiency: 'advanced' });
    expect(p.credentials).toHaveLength(1);
    expect(p.credentials[0].credentialHash).toMatch(/^[a-f0-9]{64}$/);
    expect(p.projects).toHaveLength(1);
    expect(p.internships).toHaveLength(1);
    expect(p.research).toHaveLength(1);
    expect(p.summary).toMatchObject({ totalSkills: 1, verifiedCredentials: 1, projects: 1 });
  });

  it('leaves AI insight fields null until the Python layer is connected', async () => {
    const { learner } = await seedLearner();
    const res = await request(app).get('/api/passport/me').set(auth(learner.token));
    expect(res.body.data.insights).toEqual({
      employabilityScore: null,
      skillGaps: null,
      learningRecommendations: null,
    });
  });

  it('excludes unverified credentials from the passport', async () => {
    const { learner } = await seedLearner();
    await request(app).post('/api/credentials').set(auth(learner.token)).send({
      title: 'Pending Cert', issuer: 'Somewhere', issueDate: '2026-01-01',
    });

    const res = await request(app).get('/api/passport/me').set(auth(learner.token));
    expect(res.body.data.credentials).toHaveLength(1);
  });

  it('a recruiter can read a learner passport but a learner cannot read another', async () => {
    const { learner } = await seedLearner();
    const recruiter = await makeUser({ role: 'employer_recruiter' });
    const otherLearner = await makeUser();

    const ok = await request(app)
      .get(`/api/passport/user/${learner.user._id}`)
      .set(auth(recruiter.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.holder.email).toBeUndefined();

    const denied = await request(app)
      .get(`/api/passport/user/${learner.user._id}`)
      .set(auth(otherLearner.token));
    expect(denied.status).toBe(403);
  });
});

describe('Passport sharing', () => {
  it('creates a share link that anyone can open without an account', async () => {
    const { learner } = await seedLearner();

    const created = await request(app)
      .post('/api/passport/share')
      .set(auth(learner.token))
      .send({ label: 'Infosys application', expiresInDays: 7 });
    expect(created.status).toBe(201);
    expect(created.body.data.token).toBeTruthy();

    const opened = await request(app).get(`/api/passport/shared/${created.body.data.token}`);
    expect(opened.status).toBe(200);
    expect(opened.body.data.holder.name).toBe('Ajay Kumar');
    expect(opened.body.data.credentials).toHaveLength(1);
  });

  it('honours the includeCredentials and includeContact flags', async () => {
    const { learner } = await seedLearner();

    const link = (
      await request(app)
        .post('/api/passport/share')
        .set(auth(learner.token))
        .send({ includeCredentials: false, includeContact: true })
    ).body.data;

    const opened = await request(app).get(`/api/passport/shared/${link.token}`);
    expect(opened.body.data.credentials).toHaveLength(0);
    expect(opened.body.data.holder.email).toBe(learner.user.email);
  });

  it('counts views', async () => {
    const { learner } = await seedLearner();
    const link = (
      await request(app).post('/api/passport/share').set(auth(learner.token)).send({})
    ).body.data;

    await request(app).get(`/api/passport/shared/${link.token}`);
    await request(app).get(`/api/passport/shared/${link.token}`);

    const list = await request(app).get('/api/passport/share').set(auth(learner.token));
    expect(list.body.data[0].viewCount).toBe(2);
  });

  it('a revoked link stops working', async () => {
    const { learner } = await seedLearner();
    const link = (
      await request(app).post('/api/passport/share').set(auth(learner.token)).send({})
    ).body.data;

    const revoked = await request(app)
      .delete(`/api/passport/share/${link.token}`)
      .set(auth(learner.token));
    expect(revoked.status).toBe(200);

    const opened = await request(app).get(`/api/passport/shared/${link.token}`);
    expect(opened.status).toBe(404);
  });

  it('an expired link stops working', async () => {
    const ShareLink = require('../models/ShareLink');
    const { learner } = await seedLearner();
    const link = (
      await request(app).post('/api/passport/share').set(auth(learner.token)).send({})
    ).body.data;

    await ShareLink.updateOne(
      { token: link.token },
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );

    const opened = await request(app).get(`/api/passport/shared/${link.token}`);
    expect(opened.status).toBe(404);
  });

  it('an unknown token 404s, and nobody else can revoke your link', async () => {
    const { learner } = await seedLearner();
    const stranger = await makeUser();
    const link = (
      await request(app).post('/api/passport/share').set(auth(learner.token)).send({})
    ).body.data;

    expect((await request(app).get('/api/passport/shared/deadbeef')).status).toBe(404);
    expect(
      (await request(app).delete(`/api/passport/share/${link.token}`).set(auth(stranger.token)))
        .status
    ).toBe(403);
  });

  it('rejects a bad expiry value', async () => {
    const { learner } = await seedLearner();
    const res = await request(app)
      .post('/api/passport/share')
      .set(auth(learner.token))
      .send({ expiresInDays: -5 });
    expect(res.status).toBe(400);
  });
});
