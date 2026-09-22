import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../lib/format';

const TYPES = ['certificate', 'degree', 'badge', 'course', 'license', 'other'];

export default function Credentials() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    title: '',
    issuer: '',
    credentialType: 'certificate',
    issueDate: '',
    expiryDate: '',
    file: null,
  });

  const load = () => {
    const q = status ? `?status=${status}` : '';
    api
      .get(`/credentials/me${q}`)
      .then((res) => setItems(res.data.data || []))
      .catch((err) => setError(err.apiMessage));
  };

  useEffect(() => {
    load();
  }, [status]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'file') {
        if (v) data.append('file', v);
      } else if (v) data.append(k, v);
    });
    try {
      await api.post('/credentials', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ title: '', issuer: '', credentialType: 'certificate', issueDate: '', expiryDate: '', file: null });
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const requestVerify = async (id) => {
    try {
      await api.post('/verifications', { credentialId: id });
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this credential?')) return;
    await api.delete(`/credentials/${id}`);
    load();
  };

  return (
    <div className="container page">
      <div className="section-title">
        <h2>Credential management</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {error && <div className="alert">{error}</div>}
      <form className="panel form" onSubmit={create}>
        <strong>Add a credential</strong>
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <input placeholder="Issuer" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} required />
        <select value={form.credentialType} onChange={(e) => setForm({ ...form, credentialType: e.target.value })}>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <div className="row">
          <label>Issue date<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required /></label>
          <label>Expiry (optional)<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></label>
        </div>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
        <button className="btn btn-primary" type="submit">Upload</button>
      </form>
      <div className="grid" style={{ marginTop: 24 }}>
        {items.map((c, i) => (
          <article key={c._id} className="card">
            <div className={`card-media alt${(i % 4) + 1}`}>
              <span className="chip">{c.credentialType}</span>
            </div>
            <h3>{c.title}</h3>
            <p>{c.issuer} · {formatDate(c.issueDate)}</p>
            <div className="meta">
              <span className={`pill ${c.status}`}>{c.status}</span>
              <Link to={`/credentials/${c._id}`}>Open</Link>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {c.status !== 'verified' && (
                <button className="btn btn-ghost" type="button" onClick={() => requestVerify(c._id)}>
                  Request verification
                </button>
              )}
              <button className="btn btn-danger" type="button" onClick={() => remove(c._id)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {items.length === 0 && <div className="empty">No credentials yet — add your first stay on this passport.</div>}
    </div>
  );
}
