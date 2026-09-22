import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <h4>Support</h4>
          <Link to="/verify">Verify a credential</Link>
          <p>Identity hashes stay on your device copy — we never store raw IDs.</p>
        </div>
        <div>
          <h4>Hosting</h4>
          <Link to="/register">Create a passport</Link>
          <Link to="/share">Share with recruiters</Link>
        </div>
        <div>
          <h4>SkillStay</h4>
          <Link to="/explore">Explore skills</Link>
          <Link to="/login">Log in</Link>
        </div>
        <div>
          <h4>Coming later</h4>
          <p>Blockchain anchoring</p>
          <p>AI talent matching</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} SkillStay · Digital Skill Passport</span>
        <span>Privacy · Terms · Sitemap</span>
      </div>
    </footer>
  );
}
