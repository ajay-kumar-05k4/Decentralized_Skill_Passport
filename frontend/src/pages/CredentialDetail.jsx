import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import { formatDate, fileUrl } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export default function CredentialDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cred, setCred] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});

  const load = () => {
    api
      .get(`/credentials/${id}`)
      .then((res) => {
        setCred(res.data.data);
        setForm({
          title: res.data.data.title,
          issuer: res.data.data.issuer,
          credentialType: res.data.data.credentialType,
          issueDate: res.data.data.issueDate?.slice(0, 10) || '',
          expiryDate: res.data.data.expiryDate ? res.data.data.expiryDate.slice(0, 10) : '',
        });
      })
      .catch((err) => setError(err.apiMessage));
  };

  useEffect(() => {
    load();
  }, [id]);

  const save = async (e) => {
    e.preventDefault();
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'file') {
        if (v) data.append('file', v);
      } else if (v !== undefined) data.append(k, v);
    });
    try {
      await api.put(`/credentials/${id}`, data);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  if (error) return <div className="container"><div className="alert">{error}</div></div>;
  if (!cred) return <div className="empty">Loading credential…</div>;

  const ownerId = cred.user?._id || cred.user;
  const isOwner = ownerId === user._id;

  return (
    <div className="container page">
      <Link to="/credentials">← Back to credentials</Link>
      <h2>{cred.title}</h2>
      <p className="muted">{cred.issuer} · {formatDate(cred.issueDate)} · <span className={`pill ${cred.status}`}>{cred.status}</span></p>
      {cred.fileUrl && (
        <p><a href={fileUrl(cred.fileUrl)} target="_blank" rel="noreferrer">View attached file</a></p>
      )}
      <div className="panel">
        <p>Credential hash (share this with a verifier)</p>
        <div className="hash">{cred.credentialHash || 'Generating…'}</div>
      </div>
      {isOwner && cred.status === 'pending' && (
        <form className="panel form" style={{ marginTop: 16 }} onSubmit={save}>
          <strong>Edit while pending</strong>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          <input type="file" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
          <button className="btn btn-primary" type="submit">Save changes</button>
        </form>
      )}
    </div>
  );
}
