import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../lib/format';

export default function SharedPassport() {
  const { token } = useParams();
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/passport/shared/${token}`)
      .then((res) => setPassport(res.data.data))
      .catch((err) => setError(err.apiMessage));
  }, [token]);

  if (error) {
    return (
      <div className="container">
        <div className="alert">{error}</div>
      </div>
    );
  }
  if (!passport) return <div className="empty">Opening shared passport…</div>;

  return (
    <div className="container page">
      <p className="muted">Shared Digital Skill Passport</p>
      <h2>{passport.holder.name}</h2>
      <p>{passport.holder.headline}</p>
      <p className="muted">{passport.holder.location} {passport.holder.email ? `· ${passport.holder.email}` : ''}</p>
      <p>{passport.holder.bio}</p>
      <div className="stats">
        <div className="stat"><span>Skills</span><strong>{passport.summary.totalSkills}</strong></div>
        <div className="stat"><span>Credentials</span><strong>{passport.summary.verifiedCredentials}</strong></div>
        <div className="stat"><span>Identity verified</span><strong>{passport.holder.identityVerified ? 'Yes' : 'No'}</strong></div>
      </div>
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Skills</h3>
        {passport.skills.map((s) => (
          <p key={s.name}>
            {s.name} · {s.proficiency} · {s.endorsements} endorsements
          </p>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Verified credentials</h3>
        {(passport.credentials || []).map((c) => (
          <div key={c.credentialHash} style={{ marginBottom: 12 }}>
            <strong>{c.title}</strong>
            <div className="muted">{c.issuer} · {formatDate(c.issueDate)}</div>
            <div className="hash">{c.credentialHash}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
