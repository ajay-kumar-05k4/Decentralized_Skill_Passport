import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const CATS = [
  { id: '', label: 'All', ico: '✦' },
  { id: 'programming', label: 'Code', ico: '⌘' },
  { id: 'frontend', label: 'Frontend', ico: '◻' },
  { id: 'backend', label: 'Backend', ico: '▣' },
  { id: 'database', label: 'Data', ico: '▦' },
  { id: 'ai', label: 'AI', ico: '◎' },
  { id: 'soft-skills', label: 'People', ico: '♡' },
  { id: 'blockchain', label: 'Web3', ico: '⬡' },
  { id: 'general', label: 'General', ico: '○' },
];

export default function CategoryBar() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const active = params.get('category') || '';

  return (
    <div className="cats">
      {CATS.map((c) => (
        <button
          key={c.id || 'all'}
          type="button"
          className={`cat ${active === c.id ? 'active' : ''}`}
          onClick={() => {
            const next = new URLSearchParams();
            if (c.id) next.set('category', c.id);
            navigate(`/explore?${next.toString()}`);
          }}
        >
          <span className="ico">{c.ico}</span>
          {c.label}
        </button>
      ))}
      <Link to="/verify" className="cat">
        <span className="ico">✓</span>
        Verify
      </Link>
    </div>
  );
}
