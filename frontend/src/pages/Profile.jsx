import { useEffect, useState } from 'react';
import api from '../api/client';

const emptyEdu = { institution: '', degree: '', fieldOfStudy: '', startYear: '', endYear: '' };
const emptyExp = { company: '', title: '', description: '', startDate: '', endDate: '' };
const emptyProj = { title: '', description: '', role: '', technologies: '', url: '', startDate: '', endDate: '' };
const emptyIntern = { organization: '', role: '', description: '', startDate: '', endDate: '' };
const emptyResearch = { title: '', venue: '', year: '', doi: '', url: '' };

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', headline: '', location: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [skillId, setSkillId] = useState('');
  const [proficiency, setProficiency] = useState('intermediate');
  const [skills, setSkills] = useState([]);
  const [education, setEducation] = useState([emptyEdu]);
  const [experience, setExperience] = useState([emptyExp]);
  const [projects, setProjects] = useState([emptyProj]);
  const [internships, setInternships] = useState([emptyIntern]);
  const [research, setResearch] = useState([emptyResearch]);

  const load = async () => {
    const [p, s] = await Promise.all([api.get('/profiles/me'), api.get('/skills')]);
    setProfile(p.data.data);
    setForm({
      bio: p.data.data.bio || '',
      headline: p.data.data.headline || '',
      location: p.data.data.location || '',
    });
    setEducation(p.data.data.education?.length ? p.data.data.education : [emptyEdu]);
    setExperience(p.data.data.experience?.length ? p.data.data.experience : [emptyExp]);
    setProjects(p.data.data.projects?.length ? p.data.data.projects : [emptyProj]);
    setInternships(p.data.data.internships?.length ? p.data.data.internships : [emptyIntern]);
    setResearch(p.data.data.research?.length ? p.data.data.research : [emptyResearch]);
    setSkills(s.data.data || []);
  };

  useEffect(() => {
    load().catch((err) => setError(err.apiMessage));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...form,
        education: education.filter((x) => x.institution || x.degree),
        experience: experience.filter((x) => x.company || x.title),
        projects: projects
          .filter((x) => x.title)
          .map((x) => ({ ...x, technologies: String(x.technologies || '').split(',').map((t) => t.trim()).filter(Boolean) })),
        internships: internships.filter((x) => x.organization || x.role),
        research: research.filter((x) => x.title),
      };
      const res = await api.put('/profiles/me', payload);
      setProfile(res.data.data);
      setMsg('Profile saved');
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const addSkill = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/profiles/me/skills', { skillId, proficiency });
      setProfile(res.data.data);
      setSkillId('');
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const removeSkill = async (id) => {
    const res = await api.delete(`/profiles/me/skills/${id}`);
    setProfile(res.data.data);
  };

  if (!profile && !error) return <div className="empty">Loading profile…</div>;

  return (
    <div className="container page">
      <h2>Skill & competency profile</h2>
      {msg && <div className="ok">{msg}</div>}
      {error && <div className="alert">{error}</div>}
      <form className="panel form" onSubmit={save}>
        <label>
          Headline
          <input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        </label>
        <label>
          Location
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </label>
        <label>
          Bio
          <textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </label>
        <Repeat title="Education" rows={education} setRows={setEducation} blank={emptyEdu} fields={['institution', 'degree', 'fieldOfStudy', 'startYear', 'endYear']} />
        <Repeat title="Experience" rows={experience} setRows={setExperience} blank={emptyExp} fields={['company', 'title', 'description', 'startDate', 'endDate']} />
        <Repeat title="Projects" rows={projects} setRows={setProjects} blank={emptyProj} fields={['title', 'role', 'technologies', 'url', 'description']} />
        <Repeat title="Internships" rows={internships} setRows={setInternships} blank={emptyIntern} fields={['organization', 'role', 'description', 'startDate', 'endDate']} />
        <Repeat title="Research" rows={research} setRows={setResearch} blank={emptyResearch} fields={['title', 'venue', 'year', 'doi', 'url']} />
        <button className="btn btn-primary" type="submit">Save profile</button>
      </form>
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Skills on this profile</h3>
        {(profile?.skills || []).map((s) => (
          <div key={s.skill?._id || s.skill} className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span>
              {s.skill?.name} · {s.proficiency} · {s.endorsedBy?.length || 0} endorsements
            </span>
            <button className="btn btn-danger" type="button" onClick={() => removeSkill(s.skill?._id || s.skill)}>
              Remove
            </button>
          </div>
        ))}
        <form className="row" onSubmit={addSkill} style={{ marginTop: 12 }}>
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)} required>
            <option value="">Choose a skill</option>
            {skills.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <select value={proficiency} onChange={(e) => setProficiency(e.target.value)}>
            {['beginner', 'intermediate', 'advanced', 'expert'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button className="btn btn-ghost" type="submit">Add skill</button>
        </form>
      </div>
    </div>
  );
}

function Repeat({ title, rows, setRows, blank, fields }) {
  return (
    <div>
      <strong>{title}</strong>
      {rows.map((row, i) => (
        <div key={i} className="row" style={{ marginTop: 8 }}>
          {fields.map((f) => (
            <input
              key={f}
              placeholder={f}
              value={Array.isArray(row[f]) ? row[f].join(', ') : row[f] || ''}
              onChange={(e) => {
                const next = rows.slice();
                next[i] = { ...next[i], [f]: e.target.value };
                setRows(next);
              }}
            />
          ))}
        </div>
      ))}
      <button className="btn btn-soft" type="button" onClick={() => setRows([...rows, { ...blank }])} style={{ marginTop: 8 }}>
        Add {title.toLowerCase()} row
      </button>
    </div>
  );
}
