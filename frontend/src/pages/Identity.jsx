import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate } from '../lib/format';

export default function Identity() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [hash, setHash] = useState('');
  const [form, setForm] = useState({ uniqueIdNumber: '', secretPhrase: '', newSecretPhrase: '' });

  const load = () => {
    api
      .get('/identity/me')
      .then((res) => setStatus(res.data.data))
      .catch((err) => setError(err.apiMessage));
  };

  useEffect(() => {
    load();
  }, []);

  const register = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/identity/me', {
        uniqueIdNumber: form.uniqueIdNumber,
        secretPhrase: form.secretPhrase,
      });
      setHash(res.data.data.identityHash);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/identity/me/confirm', {
        uniqueIdNumber: form.uniqueIdNumber,
        secretPhrase: form.secretPhrase,
      });
      setHash(res.data.data.identityHash);
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.put('/identity/me', form);
      setHash(res.data.data.identityHash);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Identity (off-chain)</h2>
      <p className="muted">
        We store only a SHA-256 digest of your ID number plus a secret phrase. Raw identity numbers never
        leave this form. Blockchain anchoring is intentionally not included in this phase.
      </p>
      {error && <div className="alert">{error}</div>}
      <div className="panel">
        <p>
          Status:{' '}
          <strong>{status?.registered ? `Registered ${formatDate(status.identitySetAt)}` : 'Not registered'}</strong>
        </p>
        {hash && (
          <>
            <p>Copy this hash now — it is shown after register / recover / reset.</p>
            <div className="hash">{hash}</div>
            <button className="btn btn-soft" type="button" onClick={() => navigator.clipboard.writeText(hash)}>
              Copy hash
            </button>
          </>
        )}
      </div>
      <div className="split" style={{ marginTop: 20 }}>
        {!status?.registered && (
          <form className="panel form" onSubmit={register}>
            <strong>Register identity</strong>
            <input
              placeholder="Unique ID number (min 6 chars)"
              value={form.uniqueIdNumber}
              onChange={(e) => setForm({ ...form, uniqueIdNumber: e.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Secret phrase (min 8 chars)"
              value={form.secretPhrase}
              onChange={(e) => setForm({ ...form, secretPhrase: e.target.value })}
              required
            />
            <button className="btn btn-primary" type="submit">Register</button>
          </form>
        )}
        {status?.registered && (
          <>
            <form className="panel form" onSubmit={confirm}>
              <strong>Recover hash</strong>
              <input
                placeholder="Unique ID number"
                value={form.uniqueIdNumber}
                onChange={(e) => setForm({ ...form, uniqueIdNumber: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Current secret phrase"
                value={form.secretPhrase}
                onChange={(e) => setForm({ ...form, secretPhrase: e.target.value })}
                required
              />
              <button className="btn btn-ghost" type="submit">Show hash</button>
            </form>
            <form className="panel form" onSubmit={reset}>
              <strong>Reset secret</strong>
              <input
                placeholder="Unique ID number"
                value={form.uniqueIdNumber}
                onChange={(e) => setForm({ ...form, uniqueIdNumber: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Current secret phrase"
                value={form.secretPhrase}
                onChange={(e) => setForm({ ...form, secretPhrase: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="New secret phrase"
                value={form.newSecretPhrase}
                onChange={(e) => setForm({ ...form, newSecretPhrase: e.target.value })}
                required
              />
              <button className="btn btn-danger" type="submit">Reset identity</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
