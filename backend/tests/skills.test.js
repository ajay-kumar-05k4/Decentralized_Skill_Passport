const { app, request, makeUser, makeAdmin, auth } = require('./helpers');

const createSkill = async (token, body) =>
  request(app).post('/api/skills').set(auth(token)).send(body);

describe('Skill master list', () => {
  it('an administrator can create a skill', async () => {
    const admin = await makeAdmin();
    const res = await createSkill(admin.token, { name: 'React.js', category: 'frontend' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('React.js');
  });

  it('an educational institution can also create skills', async () => {
    const inst = await makeUser({ role: 'educational_institution' });
    const res = await createSkill(inst.token, { name: 'Data Structures' });
    expect(res.status).toBe(201);
  });

  it('a learner cannot create skills', async () => {
    const learner = await makeUser();
    const res = await createSkill(learner.token, { name: 'Hacking the DB' });
    expect(res.status).toBe(403);
  });

  it('requires a name', async () => {
    const admin = await makeAdmin();
    const res = await createSkill(admin.token, { category: 'frontend' });
    expect(res.status).toBe(400);
  });

  it('rejects a case-insensitive duplicate', async () => {
    const admin = await makeAdmin();
    await createSkill(admin.token, { name: 'Node.js' });
    const res = await createSkill(admin.token, { name: 'node.js' });
    expect(res.status).toBe(400);
  });

  it('lists, searches and filters skills', async () => {
    const admin = await makeAdmin();
    await createSkill(admin.token, { name: 'Python', category: 'programming' });
    await createSkill(admin.token, { name: 'Solidity', category: 'blockchain' });

    const all = await request(app).get('/api/skills').set(auth(admin.token));
    expect(all.body.count).toBe(2);

    const searched = await request(app).get('/api/skills?search=pyth').set(auth(admin.token));
    expect(searched.body.count).toBe(1);

    const filtered = await request(app)
      .get('/api/skills?category=blockchain')
      .set(auth(admin.token));
    expect(filtered.body.data[0].name).toBe('Solidity');
  });

  it('handles regex metacharacters in search without crashing', async () => {
    const admin = await makeAdmin();
    const res = await request(app).get('/api/skills?search=%28%5B').set(auth(admin.token));
    expect(res.status).toBe(200);
  });

  it('fetches a single skill and 404s on a missing one', async () => {
    const admin = await makeAdmin();
    const created = await createSkill(admin.token, { name: 'MongoDB' });

    const ok = await request(app)
      .get(`/api/skills/${created.body.data._id}`)
      .set(auth(admin.token));
    expect(ok.status).toBe(200);

    const missing = await request(app)
      .get('/api/skills/64b7f1d2a1b2c3d4e5f60718')
      .set(auth(admin.token));
    expect(missing.status).toBe(404);
  });

  it('deleting a skill also pulls it off every profile', async () => {
    const admin = await makeAdmin();
    const learner = await makeUser();
    const skill = (await createSkill(admin.token, { name: 'Java' })).body.data;

    await request(app)
      .post('/api/profiles/me/skills')
      .set(auth(learner.token))
      .send({ skillId: skill._id });

    const del = await request(app)
      .delete(`/api/skills/${skill._id}`)
      .set(auth(admin.token));
    expect(del.status).toBe(200);

    const profile = await request(app).get('/api/profiles/me').set(auth(learner.token));
    expect(profile.body.data.skills).toHaveLength(0);
  });

  it('a non-admin cannot delete a skill', async () => {
    const admin = await makeAdmin();
    const inst = await makeUser({ role: 'educational_institution' });
    const skill = (await createSkill(admin.token, { name: 'Go' })).body.data;

    const res = await request(app).delete(`/api/skills/${skill._id}`).set(auth(inst.token));
    expect(res.status).toBe(403);
  });
});
