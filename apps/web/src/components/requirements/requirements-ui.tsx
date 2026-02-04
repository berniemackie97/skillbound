import type {
  Requirement,
  RequirementResult,
  RequirementStatus,
} from '@skillbound/domain';

function titleize(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusClass(status: RequirementStatus) {
  return `status-pill ${status.toLowerCase().replace('_', '-')}`;
}

export function formatRequirement(requirement: Requirement) {
  switch (requirement.type) {
    case 'skill-level':
      return `${titleize(requirement.skill)} ${requirement.level}`;
    case 'combined-skill-level':
      return `Combined ${requirement.skills
        .map((skill) => titleize(skill))
        .join(' + ')} >= ${requirement.totalLevel}`;
    case 'combat-level':
      return `Combat level ${requirement.level}`;
    case 'quest-complete':
      return `Quest: ${titleize(requirement.questId)}`;
    case 'diary-complete':
      return `Diary: ${titleize(requirement.diaryId)} (${requirement.tier})`;
    case 'diary-task':
      return `Diary task: ${titleize(requirement.taskId)}`;
    case 'unlock-flag':
      return `Unlock: ${titleize(requirement.flagId)}`;
    case 'activity-score':
      return `Activity: ${titleize(requirement.activityKey)} >= ${requirement.score}`;
    case 'combat-achievement':
      return `Combat achievement: ${titleize(requirement.achievementId)}`;
    case 'item-possessed':
      return `Item: ${requirement.itemId}`;
    case 'manual-check':
      return requirement.label;
    case 'all-of':
      return 'All of';
    case 'any-of':
      return 'Any of';
    default:
      return 'Requirement';
  }
}

export function RequirementList({ items }: { items: RequirementResult[] }) {
  if (!items.length) {
    return <div className="muted">No requirements listed.</div>;
  }

  return (
    <ul className="requirements-list">
      {items.map((item, index) => (
        <li key={`${item.requirement.type}-${index}`}>
          <span className={statusClass(item.status)}>{item.status}</span>
          <span>{formatRequirement(item.requirement)}</span>
          {item.children && item.children.length > 0 && (
            <RequirementList items={item.children} />
          )}
        </li>
      ))}
    </ul>
  );
}
