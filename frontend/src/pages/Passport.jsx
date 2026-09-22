import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../lib/format';

export default function Passport() {
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/passport/me')
      .then((res) => setPassport(res.data.data))
      .catch((err) => setError(err.apiMessage));
  }, []);

  if (error) return <div className="container"><div className="alert">{error}</div></div>;
  if (!passport) return <div className="empty">Opening your passport…</div>;

  const { holder, summary, skills, credentials, education, experience, projects, internships, research } =
    passport;

  return (
    <div className="container page">
      <div className="section-title">
        <div>
          <h2>{holder.name}</h2>
          <p className="muted">{holder.headline || 'Add a headline on your profile'}</p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" to="/share">
            Share
          </Link>
          <Link className="btn btn-primary" to="/profile">
            Edit profile
          </Link>
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>Skills</span><strong>{summary.totalSkills}</strong></div>
        <div className="stat"><span>Endorsements</span><strong>{summary.totalEndorsements}</strong></div>
        <div className="stat"><span>Verified credentials</span><strong>{summary.verifiedCredentials}</strong></div>
        <div className="stat"><span>Identity</span><strong>{holder.identityVerified ? 'Yes' : 'No'}</strong></div>
      </div>
      <div className="split" style={{ marginTop: 24 }}>
        <div className="panel">
          <h3>About</h3>
          <p>{holder.bio || 'No bio yet.'}</p>
          <p className="muted">
            {holder.location || 'Location not set'} · {holder.organization || 'Independent'} · Member since{' '}
            {formatDate(holder.memberSince)}
          </p>
          <h3>Skills</h3>
          {skills.length === 0 && <p className="muted">Add skills from Explore.</p>}
          {skills.map((s) => (
            <div key={s.name} className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <strong>{s.name}</strong>
                <div className="muted">{s.category} · {s.proficiency}</div>
              </div>
              <span className="pill">{s.endorsements} endorsements</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Verified credentials</h3>
          {credentials.length === 0 && (
            <p className="muted">
              None yet. <Link to="/credentials">Upload one</Link>
            </p>
          )}
          {credentials.map((c) => (
            <div key={c.credentialHash} style={{ marginBottom: 14 }}>
              <strong>{c.title}</strong>
              <div className="muted">{c.issuer} · {formatDate(c.issueDate)}</div>
              <div className="hash">{c.credentialHash}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid" style={{ marginTop: 24 }}>
        <Section title="Education" items={education} render={(e) => `${e.degree || ''} · ${e.institution || ''}`} />
        <Section title="Experience" items={experience} render={(e) => `${e.title || ''} · ${e.company || ''}`} />
        <Section title="Projects" items={projects} render={(e) => e.title} />
        <Section title="Internships" items={internships} render={(e) => `${e.role || ''} · ${e.organization || ''}`} />
        <Section title="Research" items={research} render={(e) => `${e.title || ''} · ${e.venue || ''}`} />
      </div>
    </div>
  );
}

function Section({ title, items, render }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {(items || []).length === 0 && <p className="muted">Nothing listed.</p>}
      {(items || []).map((item, i) => (
        <p key={i}>{render(item)}</p>
      ))}
    </div>
  );
}
