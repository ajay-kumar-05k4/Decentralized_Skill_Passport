import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';

export default function Review() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [comments, setComments] = useState('');

  const load = () => {
    api.get('/verifications/me').then((res) => setMine(res.data.data || [])).catch(() => {});
    const q = filter ? `?status=${filter}` : '';
    api
      .get(`/verifications${q}`)
      .then((res) => setQueue(res.data.data || []))
      .catch((err) => setError(err.apiMessage));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const claim = async (id) => {
    try {
      await api.put(`/verifications/${id}/claim`);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const decide = async (id, decision) => {
    try {
      await api.put(`/verifications/${id}/decision`, { decision, comments });
      setComments('');
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Verification queue</h2>
      {error && <div className="alert">{error}</div>}
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="in_review">In review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          placeholder="Decision comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Credential</th>
            <th>Learner</th>
            <th>Status</th>
            <th>Verifier</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {queue.map((r) => (
            <tr key={r._id}>
              <td>
                {r.credential?.title}
                <div className="muted">{formatDate(r.createdAt)}</div>
                {r.credential?._id && (
                  <Link to={`/credentials/${r.credential._id}`}>Open file</Link>
                )}
              </td>
              <td>{r.requestedBy?.name}</td>
              <td><span className={`pill ${r.status}`}>{r.status}</span></td>
              <td>{r.verifier?.name || '—'}</td>
              <td className="row">
                {r.status === 'pending' && (
                  <button className="btn btn-ghost" type="button" onClick={() => claim(r._id)}>
                    Claim
                  </button>
                )}
                {['pending', 'in_review'].includes(r.status) && r.requestedBy?._id !== user._id && (
                  <>
                    <button className="btn btn-primary" type="button" onClick={() => decide(r._id, 'approved')}>
                      Approve
                    </button>
                    <button className="btn btn-danger" type="button" onClick={() => decide(r._id, 'rejected')}>
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 style={{ marginTop: 32 }}>Your submitted requests</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Credential</th>
            <th>Status</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>
          {mine.map((r) => (
            <tr key={r._id}>
              <td>{r.credential?.title}</td>
              <td><span className={`pill ${r.status}`}>{r.status}</span></td>
              <td>{r.comments || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
