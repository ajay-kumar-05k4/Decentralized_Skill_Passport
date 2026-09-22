import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import CategoryBar from '../components/CategoryBar';
import SkillCard from '../components/SkillCard';
import { canManageSkills } from '../lib/roles';

export default function Explore() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [create, setCreate] = useState({ name: '', category: 'general', description: '' });

  const q = params.get('q') || '';
  const category = params.get('category') || '';

  const load = () => {
    const query = new URLSearchParams();
    if (q) query.set('search', q);
    if (category) query.set('category', category);
    api
      .get(`/skills?${query.toString()}`)
      .then((res) => setSkills(res.data.data || []))
      .catch((err) => setError(err.apiMessage || 'Could not load skills'));
  };

  useEffect(() => {
    load();
  }, [q, category]);

  const addToProfile = async (skillId) => {
    try {
      await api.post('/profiles/me/skills', { skillId, proficiency: 'beginner' });
      setToast('Added to your competency profile');
      setTimeout(() => setToast(''), 2200);
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const createSkill = async (e) => {
    e.preventDefault();
    try {
      await api.post('/skills', create);
      setCreate({ name: '', category: 'general', description: '' });
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  const removeSkill = async (id) => {
    if (!window.confirm('Delete this skill from the catalogue?')) return;
    try {
      await api.delete(`/skills/${id}`);
      load();
    } catch (err) {
      setError(err.apiMessage);
    }
  };

  return (
    <div className="page">
      <CategoryBar />
      <div className="container">
        <div className="section-title">
          <h2>{q ? `Stays matching “${q}”` : 'Explore skills'}</h2>
          <span className="muted">{skills.length} listings</span>
        </div>
        {error && <div className="alert">{error}</div>}
        {canManageSkills(user.role) && (
          <form className="panel form" style={{ marginBottom: 24 }} onSubmit={createSkill}>
            <strong>Add a catalogue skill</strong>
            <div className="row">
              <input
                placeholder="Name"
                value={create.name}
                onChange={(e) => setCreate((c) => ({ ...c, name: e.target.value }))}
                required
              />
              <input
                placeholder="Category"
                value={create.category}
                onChange={(e) => setCreate((c) => ({ ...c, category: e.target.value }))}
              />
            </div>
            <input
              placeholder="Description"
              value={create.description}
              onChange={(e) => setCreate((c) => ({ ...c, description: e.target.value }))}
            />
            <button className="btn btn-primary" type="submit">
              Publish skill
            </button>
          </form>
        )}
        {skills.length === 0 ? (
          <div className="empty">No skills in this neighbourhood yet.</div>
        ) : (
          <div className="grid">
            {skills.map((s, i) => (
              <SkillCard
                key={s._id}
                skill={s}
                index={i}
                extra={
                  <>
                    <button
                      className="btn btn-soft"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addToProfile(s._id);
                      }}
                    >
                      Add to profile
                    </button>
                    {user.role === 'administrator' && (
                      <button
                        className="btn btn-danger"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSkill(s._id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
