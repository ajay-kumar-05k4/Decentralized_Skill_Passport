import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, SELF_ASSIGNABLE_ROLES } from '../lib/roles';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'learner',
    organization: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/passport');
    } catch (err) {
      setError(err.apiMessage || 'Could not register');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Finish signing up</h1>
        <p className="muted">Pick the role that matches how you will use SkillStay.</p>
        {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}
        <form className="form" onSubmit={submit}>
          <label>
            Full name
            <input value={form.name} onChange={set('name')} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={set('password')} minLength={6} required />
          </label>
          <label>
            Role
            <select value={form.role} onChange={set('role')}>
              {SELF_ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organization (optional)
            <input value={form.organization} onChange={set('organization')} />
          </label>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Agree and continue'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
