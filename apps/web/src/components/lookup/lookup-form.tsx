import type { ModeValue } from '@/lib/lookup/lookup-types';
import { MODE_OPTIONS } from '@/lib/lookup/lookup-types';

export function LookupForm({
  username,
  mode,
}: {
  username: string;
  mode: ModeValue;
}) {
  return (
    <form action="/lookup" className="form-grid" method="get">
      <label>
        <span>Username</span>
        <input
          autoComplete="off"
          defaultValue={username}
          name="username"
          placeholder="e.g. Lynx Titan"
          spellCheck={false}
        />
      </label>

      <label>
        <span>Mode</span>
        <select defaultValue={mode} name="mode">
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button className="button" type="submit">
        Lookup
      </button>
    </form>
  );
}