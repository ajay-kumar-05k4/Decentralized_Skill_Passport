import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { canEndorse } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';

export default function Talent() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [passport, setPassport] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  const lookup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const [p, pr] = await Promise.all([
        api.get(`/passport/user/${userId}`),
        api.get(`/profiles/${userId}`),
      ]);
      setPassport(p.data.data);
      setProfile(pr.data.data);
    } catch (err) {
      setError(err.apiMessage);
      setPassport(null);
      setProfile(null);
    }
  };

  const endorse = async (skillId) => {
    try {
      const res = await api.post(`/profiles/${userId}/skills/${skillId}/endorse`);
      setProfile(res.data.data);
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="container page">
      <h2>Talent lookup</h2>
      <p className="muted">
        Employers and mentors can open a learner passport by user ID. Public share links live at{' '}
        <Link to="/verify">/verify</Link> and <code>/p/:token</code>.
      </p>
      {error && <div className="alert">{error}</div>}
      <form className="panel form" onSubmit={lookup}>
        <input placeholder="Learner user ID" value={userId} onChange={(e) => setUserId(e.target.value)} required />
        <button className="btn btn-primary" type="submit">Open passport</button>
      </form>
      {passport && (
        <div style={{ marginTop: 24 }}>
          <h3>{passport.holder.name}</h3>
          <p>{passport.holder.headline}</p>
          <p className="muted">{passport.holder.location} · identity {passport.holder.identityVerified ? 'verified' : 'unverified'}</p>
          <div className="panel">
            {(profile?.skills || []).map((s) => (
              <div key={s.skill?._id} className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span>
                  {s.skill?.name} · {s.proficiency} · {s.endorsedBy?.length || 0} endorsements
                </span>
                {canEndorse(user.role) && (
                  <button className="btn btn-ghost" type="button" onClick={() => endorse(s.skill._id)}>
                    Endorse
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            {(passport.credentials || []).map((c) => (
              <p key={c.credentialHash}>
                {c.title} · {c.issuer} · {formatDate(c.issueDate)}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
