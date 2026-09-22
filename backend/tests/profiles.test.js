const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

const newSkill = async (adminToken, name) =>
  (await request(app).post('/api/skills').set(auth(adminToken)).send({ name })).body.data;

describe('Skill & Competency Profile', () => {
  it('GET /api/profiles/me returns the profile with the user populated', async () => {
    const { user, token } = await makeUser();
    const res = await request(app).get('/api/profiles/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('PUT /api/profiles/me updates bio, headline, education and experience', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .put('/api/profiles/me')
      .set(auth(token))
      .send({
        bio: 'Final year CSE student',
        headline: 'Full stack + web3',
        location: 'Hyderabad',
        education: [{ institution: 'JNTUH', degree: 'B.Tech', fieldOfStudy: 'CSE', startYear: 2023, endYear: 2027 }],
        experience: [{ company: 'Acme', title: 'Intern', startDate: '2025-05-01' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('Final year CSE student');
    expect(res.body.data.education).toHaveLength(1);
    expect(res.body.data.experience[0].company).toBe('Acme');
  });

  it('adds a skill, updates its proficiency, and does not duplicate it', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const skill = await newSkill(admin.token, 'TypeScript');

    const added = await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id, proficiency: 'intermediate' });
    expect(added.status).toBe(200);
    expect(added.body.data.skills[0].proficiency).toBe('intermediate');
    expect(added.body.data.skills[0].skill.name).toBe('TypeScript');

    const again = await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id, proficiency: 'expert' });
    expect(again.body.data.skills).toHaveLength(1);
    expect(again.body.data.skills[0].proficiency).toBe('expert');
  });

  it('rejects a missing skillId, unknown skill, and bad proficiency', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const skill = await newSkill(admin.token, 'Rust');

    expect(
      (await request(app).post('/api/profiles/me/skills').set(auth(learner.token)).send({})).status
    ).toBe(400);

    expect(
      (
        await request(app)
          .post('/api/profiles/me/skills')
          .set(auth(learner.token))
          .send({ skillId: '64b7f1d2a1b2c3d4e5f60718' })
      ).status
    ).toBe(404);

    expect(
      (
        await request(app)
          .post('/api/profiles/me/skills')
          .set(auth(learner.token))
          .send({ skillId: skill._id, proficiency: 'godlike' })
      ).status
    ).toBe(400);
  });

  it('removes a skill from the profile', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const skill = await newSkill(admin.token, 'Docker');

    await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id });

    const res = await request(app)
      .delete(`/api/profiles/me/skills/${skill._id}`)
      .set(auth(learner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.skills).toHaveLength(0);

    const again = await request(app)
      .delete(`/api/profiles/me/skills/${skill._id}`)
      .set(auth(learner.token));
    expect(again.status).toBe(404);
  });

  it('a recruiter can view a learner profile by user id', async () => {
    const learner = await makeUser();
    const recruiter = await makeUser({ role: 'employer_recruiter' });

    const res = await request(app)
      .get(`/api/profiles/${learner.user._id}`)
      .set(auth(recruiter.token));
    expect(res.status).toBe(200);
    expect(res.body.data.user._id).toBe(learner.user._id);
  });

  it('404s for a profile that does not exist', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .get('/api/profiles/64b7f1d2a1b2c3d4e5f60718')
      .set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe('Skill endorsement', () => {
  const setup = async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const skill = await newSkill(admin.token, 'GraphQL');
    await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id });
    return { admin, learner, skill };
  };

  it('a mentor can endorse a learner skill, and endorsing twice is idempotent', async () => {
    const { learner, skill } = await setup();
    const mentor = await makeUser({ role: 'mentor_industry_expert' });

    const first = await request(app)
      .post(`/api/profiles/${learner.user._id}/skills/${skill._id}/endorse`)
      .set(auth(mentor.token));
    expect(first.status).toBe(200);
    expect(first.body.data.skills[0].endorsedBy).toHaveLength(1);

    const second = await request(app)
      .post(`/api/profiles/${learner.user._id}/skills/${skill._id}/endorse`)
      .set(auth(mentor.token));
    expect(second.body.data.skills[0].endorsedBy).toHaveLength(1);
  });

  it('a learner cannot endorse anyone', async () => {
    const { learner, skill } = await setup();
    const other = await makeUser();
    const res = await request(app)
      .post(`/api/profiles/${learner.user._id}/skills/${skill._id}/endorse`)
      .set(auth(other.token));
    expect(res.status).toBe(403);
  });

  it('nobody can endorse their own skill', async () => {
    const admin = await makeAdmin();
    const skill = await newSkill(admin.token, 'Kubernetes');
    await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(admin.token))
      .send({ skillId: skill._id });

    const res = await request(app)
      .post(`/api/profiles/${admin.user._id}/skills/${skill._id}/endorse`)
      .set(auth(admin.token));
    expect(res.status).toBe(400);
  });

  it('404s when endorsing a skill the profile does not have', async () => {
    const { learner } = await setup();
    const mentor = await makeUser({ role: 'mentor_industry_expert' });
    const res = await request(app)
      .post(`/api/profiles/${learner.user._id}/skills/64b7f1d2a1b2c3d4e5f60718/endorse`)
      .set(auth(mentor.token));
    expect(res.status).toBe(404);
  });
});
