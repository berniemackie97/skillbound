import { formatNumber } from '@/lib/format/format-number';
import type { getTopSkills } from '@/lib/lookup/lookup-data';

export function SkillTilesPanel({
  skills,
}: {
  skills: ReturnType<typeof getTopSkills>;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Skill tiles</h2>
          <p>Quick scan of levels, XP, and ranks by skill.</p>
        </div>
      </div>

      <div className="tile-grid">
        {skills.map((skill) => (
          <div key={skill.key} className="skill-tile">
            <div className="skill-header">
              <span>{skill.name}</span>
              <span className="pill subtle">Lv {skill.level}</span>
            </div>

            <div className="skill-meta">
              <span>XP</span>
              <strong>{formatNumber(skill.xp)}</strong>
            </div>

            <div className="skill-meta">
              <span>Rank</span>
              <strong>{formatNumber(skill.rank)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}