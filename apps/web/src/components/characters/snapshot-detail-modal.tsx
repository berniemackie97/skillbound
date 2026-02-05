'use client';

import { Modal } from '@/components/ui/modal';

interface SkillData {
  name: string;
  level: number;
  xp: number;
  rank?: number | null;
}

interface SnapshotData {
  id: string;
  capturedAt: string;
  dataSource: string;
  totalLevel: number;
  totalXp: number;
  combatLevel: number;
  skills: SkillData[];
  activities?: Record<string, number>;
  isMilestone?: boolean;
  milestoneType?: string | null;
  milestoneData?: Record<string, unknown> | null;
}

interface SnapshotDetailModalProps {
  snapshot: SnapshotData | null;
  previousSnapshot?: SnapshotData | null;
  onClose: () => void;
}

function formatXp(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatDelta(value: number): string {
  if (value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatXp(value)}`;
}

export function SnapshotDetailModal({
  snapshot,
  previousSnapshot,
  onClose,
}: SnapshotDetailModalProps) {
  if (!snapshot) {
    return null;
  }

  const capturedDate = new Date(snapshot.capturedAt);

  // Calculate skill deltas if we have a previous snapshot
  const skillDeltas = previousSnapshot
    ? snapshot.skills.map((skill) => {
        const prevSkill = previousSnapshot.skills.find(
          (s) => s.name === skill.name
        );
        return {
          ...skill,
          deltaXp: skill.xp - (prevSkill?.xp ?? skill.xp),
          deltaLevel: skill.level - (prevSkill?.level ?? skill.level),
        };
      })
    : snapshot.skills.map((skill) => ({
        ...skill,
        deltaXp: 0,
        deltaLevel: 0,
      }));

  // Sort skills by XP delta (most gained first), then by name
  const sortedSkills = [...skillDeltas].sort((a, b) => {
    if (b.deltaXp !== a.deltaXp) return b.deltaXp - a.deltaXp;
    return a.name.localeCompare(b.name);
  });

  // Calculate overall deltas
  const overallDelta = previousSnapshot
    ? {
        totalXp: snapshot.totalXp - previousSnapshot.totalXp,
        totalLevel: snapshot.totalLevel - previousSnapshot.totalLevel,
        combatLevel: snapshot.combatLevel - previousSnapshot.combatLevel,
      }
    : null;

  return (
    <Modal
      isOpen={true}
      size="lg"
      subtitle={capturedDate.toLocaleString()}
      title="Snapshot Details"
      onClose={onClose}
    >
      {/* Overview Stats */}
      <div className="snapshot-overview">
        <div className="snapshot-stat">
          <span className="label">Total Level</span>
          <strong>{snapshot.totalLevel.toLocaleString()}</strong>
          {overallDelta && overallDelta.totalLevel !== 0 && (
            <span
              className={`delta ${overallDelta.totalLevel > 0 ? 'positive' : 'negative'}`}
            >
              {overallDelta.totalLevel > 0 ? '+' : ''}
              {overallDelta.totalLevel}
            </span>
          )}
        </div>
        <div className="snapshot-stat">
          <span className="label">Total XP</span>
          <strong>{formatXp(snapshot.totalXp)}</strong>
          {overallDelta && overallDelta.totalXp !== 0 && (
            <span
              className={`delta ${overallDelta.totalXp > 0 ? 'positive' : 'negative'}`}
            >
              {formatDelta(overallDelta.totalXp)}
            </span>
          )}
        </div>
        <div className="snapshot-stat">
          <span className="label">Combat Level</span>
          <strong>{snapshot.combatLevel}</strong>
          {overallDelta && overallDelta.combatLevel !== 0 && (
            <span
              className={`delta ${overallDelta.combatLevel > 0 ? 'positive' : 'negative'}`}
            >
              {overallDelta.combatLevel > 0 ? '+' : ''}
              {overallDelta.combatLevel}
            </span>
          )}
        </div>
        <div className="snapshot-stat">
          <span className="label">Data Source</span>
          <strong>{snapshot.dataSource}</strong>
        </div>
      </div>

      {/* Milestone Badge */}
      {snapshot.isMilestone && snapshot.milestoneType && (
        <div className="snapshot-milestone-badge">
          <span className="milestone-icon">
            <svg
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </span>
          <span>
            {snapshot.milestoneType.replace(/_/g, ' ')}
            {snapshot.milestoneData && (
              <>: {JSON.stringify(snapshot.milestoneData)}</>
            )}
          </span>
        </div>
      )}

      {/* Skills Grid */}
      <div className="snapshot-skills-section">
        <h4>Skills</h4>
        <div className="snapshot-skills-grid">
          {sortedSkills.map((skill) => (
            <div
              key={skill.name}
              className={`snapshot-skill ${skill.deltaXp > 0 ? 'gained' : ''}`}
            >
              <span className="skill-name">{skill.name}</span>
              <div className="skill-stats">
                <span className="skill-level">Lv. {skill.level}</span>
                <span className="skill-xp">{formatXp(skill.xp)} XP</span>
              </div>
              {skill.deltaXp > 0 && (
                <span className="skill-delta positive">
                  +{formatXp(skill.deltaXp)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Activities */}
      {snapshot.activities && Object.keys(snapshot.activities).length > 0 && (
        <div className="snapshot-activities-section">
          <h4>Activities</h4>
          <div className="snapshot-activities-grid">
            {Object.entries(snapshot.activities).map(([name, value]) => (
              <div key={name} className="snapshot-activity">
                <span className="activity-name">{name}</span>
                <strong>{value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
