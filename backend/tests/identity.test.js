const { app, request, makeUser, auth } = require('./helpers');
const { buildIdentityHash } = require('../utils/hash');

const ID_NUMBER = '1234-5678-9012';
const PHRASE = 'my-very-secret-phrase';

describe('Decentralized identity anchor', () => {
  it('registers an identity and returns a SHA-256 hash', async () => {
    const { token } = await makeUser();
    const res = await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    expect(res.status).toBe(201);
    expect(res.body.data.identityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.data.identityHash).toBe(buildIdentityHash(ID_NUMBER, PHRASE));
  });

  it('never persists the raw identity number or secret phrase', async () => {
    const User = require('../models/User');
    const { user, token } = await makeUser();
    await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const stored = await User.findById(user._id).lean();
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain(ID_NUMBER);
    expect(serialized).not.toContain(PHRASE);
    expect(stored.identityHash).toBeTruthy();
  });

  it('validates both inputs and their minimum lengths', async () => {
    const { token } = await makeUser();
    const cases = [
      {},
      { uniqueIdNumber: ID_NUMBER },
      { secretPhrase: PHRASE },
      { uniqueIdNumber: '123', secretPhrase: PHRASE },
      { uniqueIdNumber: ID_NUMBER, secretPhrase: 'short' },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/identity/me').set(auth(token)).send(body);
      expect(res.status).toBe(400);
    }
  });

  it('refuses a second registration on the same account', async () => {
    const { token } = await makeUser();
    await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const again = await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: '9999-8888-7777', secretPhrase: PHRASE });
    expect(again.status).toBe(409);
  });

  it('refuses the same identity on two different accounts', async () => {
    const first = await makeUser();
    const second = await makeUser();

    await request(app)
      .post('/api/identity/me')
      .set(auth(first.token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const res = await request(app)
      .post('/api/identity/me')
      .set(auth(second.token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });
    expect(res.status).toBe(409);
  });

  it('reports status without leaking the hash', async () => {
    const { token } = await makeUser();

    const before = await request(app).get('/api/identity/me').set(auth(token));
    expect(before.body.data.registered).toBe(false);

    await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const after = await request(app).get('/api/identity/me').set(auth(token));
    expect(after.body.data.registered).toBe(true);
    expect(after.body.data.identityHash).toBeUndefined();
  });

  it('recovers the hash with the correct details and refuses wrong ones', async () => {
    const { token } = await makeUser();
    await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const ok = await request(app)
      .post('/api/identity/me/confirm')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });
    expect(ok.status).toBe(200);
    expect(ok.body.data.identityHash).toBe(buildIdentityHash(ID_NUMBER, PHRASE));

    const bad = await request(app)
      .post('/api/identity/me/confirm')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: 'wrong-phrase-entirely' });
    expect(bad.status).toBe(401);
  });

  it('resets the identity so the old hash stops verifying', async () => {
    const { token } = await makeUser();
    await request(app)
      .post('/api/identity/me')
      .set(auth(token))
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });

    const reset = await request(app)
      .put('/api/identity/me')
      .set(auth(token))
      .send({
        uniqueIdNumber: ID_NUMBER,
        secretPhrase: PHRASE,
        newSecretPhrase: 'a-brand-new-secret',
      });
    expect(reset.status).toBe(200);
    expect(reset.body.data.identityHash).toBe(
      buildIdentityHash(ID_NUMBER, 'a-brand-new-secret')
    );

    const old = await request(app)
      .post('/api/verify/identity')
      .send({ identityHash: buildIdentityHash(ID_NUMBER, PHRASE) });
    expect(old.body.data.valid).toBe(false);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/identity/me')
      .send({ uniqueIdNumber: ID_NUMBER, secretPhrase: PHRASE });
    expect(res.status).toBe(401);
  });
});
