import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate, shareUrl } from '../lib/format';

export default function SharePassport() {
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    label: '',
    expiresInDays: 7,
    includeCredentials: true,
    includeContact: false,
  });

  const load = () => {
    api
      .get('/passport/share')
      .then((res) => setLinks(res.data.data || []))
      .catch((err) => setError(err.apiMessage));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/passport/share', form);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const revoke = async (token) => {
    await api.delete(`/passport/share/${token}`);
    load();
  };

  return (
    <div className="container page">
      <h2>Share your passport</h2>
      {error && <div className="alert">{error}</div>}
      <form className="panel form" onSubmit={create}>
        <input
          placeholder="Label (e.g. Acme recruiter)"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <label>
          Expires in days
          <input
            type="number"
            min="1"
            value={form.expiresInDays}
            onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.includeCredentials}
            onChange={(e) => setForm({ ...form, includeCredentials: e.target.checked })}
          />{' '}
          Include verified credentials
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.includeContact}
            onChange={(e) => setForm({ ...form, includeContact: e.target.checked })}
          />{' '}
          Include email
        </label>
        <button className="btn btn-primary" type="submit">Create share link</button>
      </form>
      <table className="table" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>Label</th>
            <th>Link</th>
            <th>Views</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr key={l.token}>
              <td>{l.label || 'Untitled'}</td>
              <td>
                <button
                  className="btn btn-soft"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareUrl(l.token))}
                >
                  Copy URL
                </button>
              </td>
              <td>{l.viewCount}</td>
              <td>{l.revokedAt ? 'Revoked' : l.expiresAt ? formatDate(l.expiresAt) : 'Never'}</td>
              <td>
                {!l.revokedAt && (
                  <button className="btn btn-danger" type="button" onClick={() => revoke(l.token)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
