import { useEffect, useState } from 'react';
import api from '../api/client';
import { ROLE_LABELS } from '../lib/roles';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = () => {
    api.get('/users/stats/overview').then((res) => setStats(res.data.data)).catch((err) => setError(err.apiMessage));
    const q = new URLSearchParams({ page, limit: 20 });
    if (search) q.set('search', search);
    if (role) q.set('role', role);
    api.get(`/users?${q}`).then((res) => {
      setUsers(res.data.data || []);
      setPages(res.data.pages || 1);
    });
  };

  useEffect(() => {
    load();
  }, [page, role]);

  const saveUser = async (id, patch) => {
    try {
      await api.put(`/users/${id}`, patch);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this user and their passport data?')) return;
    try {
      await api.delete(`/users/${id}`);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Administrator dashboard</h2>
      {error && <div className="alert">{error}</div>}
      {stats && (
        <div className="stats">
          <div className="stat"><span>Users</span><strong>{stats.users.total}</strong></div>
          <div className="stat"><span>Active</span><strong>{stats.users.active}</strong></div>
          <div className="stat"><span>Identity verified</span><strong>{stats.users.identityVerified}</strong></div>
          <div className="stat"><span>Skills</span><strong>{stats.skills.total}</strong></div>
          <div className="stat"><span>Credentials</span><strong>{stats.credentials.total}</strong></div>
          <div className="stat"><span>Verified</span><strong>{stats.credentials.verified}</strong></div>
          <div className="stat"><span>Queue pending</span><strong>{stats.verificationQueue.pending}</strong></div>
          <div className="stat"><span>In review</span><strong>{stats.verificationQueue.inReview}</strong></div>
        </div>
      )}
      <form
        className="row"
        style={{ margin: '20px 0' }}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
      >
        <input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {Object.keys(ROLE_LABELS).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button className="btn btn-ghost" type="submit">Search</button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Active</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => saveUser(u._id, { role: e.target.value })}>
                  {Object.keys(ROLE_LABELS).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td>
                <button className="btn btn-soft" type="button" onClick={() => saveUser(u._id, { isActive: !u.isActive })}>
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </td>
              <td><code>{u._id}</code></td>
              <td>
                <button className="btn btn-danger" type="button" onClick={() => remove(u._id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-soft" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
        <span>Page {page} / {pages}</span>
        <button className="btn btn-soft" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}
