const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

describe('Notifications and alerts', () => {
  it('notifies the learner when they add a credential', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'AWS Cloud Practitioner', issuer: 'AWS', issueDate: '2026-03-01',
    });

    const res = await request(app).get('/api/notifications').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((n) => n.type === 'credential_submitted')).toBe(true);
  });

  it('notifies the learner through the whole verification lifecycle', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();

    const cred = (
      await request(app).post('/api/credentials').set(auth(learner.token)).send({
        title: 'B.Tech CSE', issuer: 'CVR College', issueDate: '2027-05-30',
      })
    ).body.data;

    const vr = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    await request(app).put(`/api/verifications/${vr._id}/claim`).set(auth(admin.token));
    await request(app)
      .put(`/api/verifications/${vr._id}/decision`)
      .set(auth(admin.token))
      .send({ decision: 'approved' });

    const res = await request(app).get('/api/notifications').set(auth(learner.token));
    const types = res.body.data.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'credential_submitted',
        'verification_requested',
        'verification_claimed',
        'verification_approved',
      ])
    );
  });

  it('a rejection notification carries the verifier comments', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const cred = (
      await request(app).post('/api/credentials').set(auth(learner.token)).send({
        title: 'Suspicious Cert', issuer: 'Unknown', issueDate: '2026-01-01',
      })
    ).body.data;
    const vr = (
      await request(app)
        .post('/api/verifications')
        .set(auth(learner.token))
        .send({ credentialId: cred._id })
    ).body.data;

    await request(app)
      .put(`/api/verifications/${vr._id}/decision`)
      .set(auth(admin.token))
      .send({ decision: 'rejected', comments: 'Issuer could not be confirmed' });

    const res = await request(app).get('/api/notifications').set(auth(learner.token));
    const rejection = res.body.data.find((n) => n.type === 'verification_rejected');
    expect(rejection.message).toContain('Issuer could not be confirmed');
  });

  it('notifies the profile owner when a skill is endorsed', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const mentor = await makeUser({ role: 'mentor_industry_expert', name: 'Suhail Afroz' });

    const skill = (
      await request(app).post('/api/skills').set(auth(admin.token)).send({ name: 'Node.js' })
    ).body.data;
    await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id });

    await request(app)
      .post(`/api/profiles/${learner.user._id}/skills/${skill._id}/endorse`)
      .set(auth(mentor.token));

    const res = await request(app).get('/api/notifications').set(auth(learner.token));
    const endorsement = res.body.data.find((n) => n.type === 'skill_endorsed');
    expect(endorsement).toBeTruthy();
    expect(endorsement.message).toContain('Node.js');
  });

  it('filters unread, marks one read, and marks all read', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'Cert A', issuer: 'A', issueDate: '2026-01-01',
    });
    await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'Cert B', issuer: 'B', issueDate: '2026-01-01',
    });

    const unread = await request(app).get('/api/notifications?unread=true').set(auth(token));
    expect(unread.body.count).toBe(2);

    const one = await request(app)
      .put(`/api/notifications/${unread.body.data[0]._id}/read`)
      .set(auth(token));
    expect(one.body.data.read).toBe(true);

    await request(app).put('/api/notifications/read-all').set(auth(token));
    const after = await request(app).get('/api/notifications?unread=true').set(auth(token));
    expect(after.body.count).toBe(0);
  });

  it('nobody can read, modify, or delete another user notifications', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    await request(app).post('/api/credentials').set(auth(owner.token)).send({
      title: 'Private Cert', issuer: 'X', issueDate: '2026-01-01',
    });

    const mine = await request(app).get('/api/notifications').set(auth(owner.token));
    const id = mine.body.data[0]._id;

    expect((await request(app).get('/api/notifications').set(auth(stranger.token))).body.count).toBe(0);
    expect(
      (await request(app).put(`/api/notifications/${id}/read`).set(auth(stranger.token))).status
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/notifications/${id}`).set(auth(stranger.token))).status
    ).toBe(403);
  });

  it('deletes a notification', async () => {
    const { token } = await makeUser();
    await request(app).post('/api/credentials').set(auth(token)).send({
      title: 'Cert', issuer: 'X', issueDate: '2026-01-01',
    });
    const list = await request(app).get('/api/notifications').set(auth(token));

    const res = await request(app)
      .delete(`/api/notifications/${list.body.data[0]._id}`)
      .set(auth(token));
    expect(res.status).toBe(200);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});

describe('Admin platform stats', () => {
  it('returns counts across users, skills, credentials and the queue', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    await request(app).post('/api/skills').set(auth(admin.token)).send({ name: 'Python' });
    const cred = (
      await request(app).post('/api/credentials').set(auth(learner.token)).send({
        title: 'Cert', issuer: 'X', issueDate: '2026-01-01',
      })
    ).body.data;
    await request(app)
      .post('/api/verifications')
      .set(auth(learner.token))
      .send({ credentialId: cred._id });

    const res = await request(app).get('/api/users/stats/overview').set(auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.users.byRole.administrator).toBe(1);
    expect(res.body.data.skills.total).toBe(1);
    expect(res.body.data.credentials.pending).toBe(1);
    expect(res.body.data.verificationQueue.pending).toBe(1);
  });

  it('is admin-only', async () => {
    const { token } = await makeUser();
    expect((await request(app).get('/api/users/stats/overview').set(auth(token))).status).toBe(403);
  });
});
