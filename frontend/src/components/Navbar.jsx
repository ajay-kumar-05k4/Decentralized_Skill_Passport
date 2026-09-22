import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { initials } from '../lib/format';
import { canViewPassports, isVerifier, ROLE_LABELS } from '../lib/roles';

function Logo() {
  return (
    <Link to="/" className="logo">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 2c4.2 6.6 12 8.8 12 16.4C28 24.8 22.6 30 16 30S4 24.8 4 18.4C4 10.8 11.8 8.6 16 2z"
          fill="#FF385C"
        />
      </svg>
      SkillStay
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return undefined;
    api
      .get('/notifications')
      .then((res) => setUnread(res.data.unreadCount || 0))
      .catch(() => {});
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [user]);

  const search = (e) => {
    e.preventDefault();
    navigate(`/explore?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className="navbar">
      <Logo />
      <form className="search-pill" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills, categories, talent…"
        />
        <button type="submit" aria-label="Search">
          ⌕
        </button>
      </form>
      <div className="nav-right" ref={menuRef}>
        {user ? (
          <>
            <Link className="host-link" to="/passport">
              Your passport
            </Link>
            <Link className="bell" to="/notifications" aria-label="Notifications">
              🔔
              {unread > 0 && <span className="badge">{unread}</span>}
            </Link>
            <button className="user-chip" type="button" onClick={() => setOpen((v) => !v)}>
              <span aria-hidden="true">☰</span>
              <span className="avatar">{initials(user.name)}</span>
            </button>
            {open && (
              <div className="menu">
                <div style={{ padding: '10px 16px' }}>
                  <strong>{user.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {ROLE_LABELS[user.role] || user.role}
                  </div>
                </div>
                <div className="sep" />
                <Link to="/passport" onClick={() => setOpen(false)}>
                  Digital skill passport
                </Link>
                <Link to="/credentials" onClick={() => setOpen(false)}>
                  Credentials
                </Link>
                <Link to="/profile" onClick={() => setOpen(false)}>
                  Profile
                </Link>
                <Link to="/identity" onClick={() => setOpen(false)}>
                  Identity
                </Link>
                <Link to="/share" onClick={() => setOpen(false)}>
                  Share passport
                </Link>
                {isVerifier(user.role) && (
                  <Link to="/review" onClick={() => setOpen(false)}>
                    Verification queue
                  </Link>
                )}
                {canViewPassports(user.role) && (
                  <Link to="/talent" onClick={() => setOpen(false)}>
                    Talent lookup
                  </Link>
                )}
                {user.role === 'administrator' && (
                  <Link to="/admin" onClick={() => setOpen(false)}>
                    Admin dashboard
                  </Link>
                )}
                <div className="sep" />
                <Link to="/verify" onClick={() => setOpen(false)}>
                  Public verify desk
                </Link>
                <Link to="/settings" onClick={() => setOpen(false)}>
                  Account settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                    navigate('/');
                  }}
                >
                  Log out
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <Link className="host-link" to="/verify">
              Verify a credential
            </Link>
            <button className="user-chip" type="button" onClick={() => setOpen((v) => !v)}>
              <span aria-hidden="true">☰</span>
              <span className="avatar">?</span>
            </button>
            {open && (
              <div className="menu">
                <Link to="/register" onClick={() => setOpen(false)}>
                  Sign up
                </Link>
                <Link to="/login" onClick={() => setOpen(false)}>
                  Log in
                </Link>
                <div className="sep" />
                <Link to="/verify" onClick={() => setOpen(false)}>
                  Public verify desk
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
