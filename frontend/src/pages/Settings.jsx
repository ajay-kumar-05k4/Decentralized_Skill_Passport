import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, persist, token, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [organization, setOrganization] = useState(user?.organization || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.put('/users/me', { name, organization });
      persist(res.data.data, token);
      setMsg('Account updated');
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const password = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setMsg('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      await refreshUser();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Account settings</h2>
      {msg && <div className="ok">{msg}</div>}
      {error && <div className="alert">{error}</div>}
      <form className="panel form" onSubmit={save}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Organization<input value={organization} onChange={(e) => setOrganization(e.target.value)} /></label>
        <p className="muted">Email and role cannot be changed here. Admins assign roles from the dashboard.</p>
        <button className="btn btn-primary" type="submit">Save</button>
      </form>
      <form className="panel form" style={{ marginTop: 16 }} onSubmit={password}>
        <strong>Change password</strong>
        <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
        <button className="btn btn-ghost" type="submit">Update password</button>
      </form>
    </div>
  );
}
