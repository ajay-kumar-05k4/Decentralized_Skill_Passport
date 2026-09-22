const ALTS = ['', 'alt1', 'alt2', 'alt3', 'alt4'];

export default function SkillCard({ skill, index = 0, extra, onClick }) {
  return (
    <article className="card" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={`card-media ${ALTS[index % ALTS.length]}`}>
        <span className="chip">{skill.category || 'skill'}</span>
      </div>
      <h3>{skill.name}</h3>
      <p>{skill.description || 'Add this skill to your competency profile.'}</p>
      {extra && <div className="meta">{extra}</div>}
    </article>
  );
}
