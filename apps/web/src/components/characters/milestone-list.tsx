'use client';

import { useState } from 'react';

type MilestoneItem = {
  id: string;
  label: string;
  capturedAt: string;
  dataSource: string;
  totalLevel: number;
  totalXp: number;
  combatLevel: number;
  milestoneType: string | null;
  milestoneData: Record<string, unknown> | null;
};

type MilestoneListProps = {
  milestones: MilestoneItem[];
};

export function MilestoneList({ milestones }: MilestoneListProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (milestones.length === 0) {
    return <p className="muted">Milestones will appear as you level up.</p>;
  }

  return (
    <ul className="milestone-list">
      {milestones.map((milestone) => {
        const isOpen = openId === milestone.id;
        return (
          <li key={milestone.id} className="milestone-item">
            <button
              type="button"
              className="milestone-trigger"
              onClick={() => setOpenId(isOpen ? null : milestone.id)}
            >
              <span>{milestone.label}</span>
              <span className="muted">{milestone.capturedAt}</span>
            </button>
            {isOpen && (
              <div className="milestone-detail">
                <div className="metric-row">
                  <span>Snapshot</span>
                  <strong>{milestone.capturedAt}</strong>
                </div>
                <div className="metric-row">
                  <span>Data source</span>
                  <strong>{milestone.dataSource}</strong>
                </div>
                <div className="metric-row">
                  <span>Total level</span>
                  <strong>{milestone.totalLevel.toLocaleString()}</strong>
                </div>
                <div className="metric-row">
                  <span>Total XP</span>
                  <strong>{milestone.totalXp.toLocaleString()}</strong>
                </div>
                <div className="metric-row">
                  <span>Combat level</span>
                  <strong>{milestone.combatLevel}</strong>
                </div>
                {milestone.milestoneData && (
                  <pre className="milestone-json">
                    {JSON.stringify(milestone.milestoneData, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
