import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CategoryBar from '../components/CategoryBar';
import SkillCard from '../components/SkillCard';

const FEATURES = [
  { to: '/passport', title: 'Digital skill passport', text: 'One place for skills, projects and verified credentials.' },
  { to: '/credentials', title: 'Credential management', text: 'Upload certificates and request institutional review.' },
  { to: '/profile', title: 'Skill & competency profile', text: 'Headline, education, internships and endorsements.' },
  { to: '/verify', title: 'Credential verification', text: 'Anyone can check identity, credential and linkage hashes.' },
];

export default function Home() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api.get('/skills').then((res) => setSkills(res.data.data || [])).catch(() => setSkills([]));
  }, [user]);

  return (
    <div className="page">
      <CategoryBar />
      <section className="hero">
        <h1>Stay close to the skills that get you hired.</h1>
        <p>
          SkillStay is a Digital Skill Passport — learners collect credentials, institutions verify them,
          and recruiters check authenticity without a blockchain wallet.
        </p>
        <form
          className="search-pill"
          style={{ margin: '0 auto', maxWidth: 560 }}
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/explore?q=${encodeURIComponent(q)}`);
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where to? Try React, Python, Data…" />
          <button type="submit">⌕</button>
        </form>
      </section>
      <div className="container">
        <div className="section-title">
          <h2>Popular stays on your career map</h2>
        </div>
        <div className="grid">
          {FEATURES.map((f, i) => (
            <Link key={f.to} to={user || f.to === '/verify' ? f.to : '/login'} className="card">
              <div className={`card-media alt${(i % 4) + 1 === 5 ? '' : (i % 4) + 1}`}>
                <span className="chip">Feature</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Link>
          ))}
        </div>
        {user && skills.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 48 }}>
              <h2>Skill catalogue</h2>
              <Link to="/explore">Show all</Link>
            </div>
            <div className="grid">
              {skills.slice(0, 8).map((s, i) => (
                <Link key={s._id} to="/explore">
                  <SkillCard skill={s} index={i} />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
