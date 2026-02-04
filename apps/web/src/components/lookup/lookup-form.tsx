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
    <form className="form-grid" method="get" action="/lookup">
      <label>
        <span>Username</span>
        <input
          name="username"
          defaultValue={username}
          placeholder="e.g. Lynx Titan"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <label>
        <span>Mode</span>
        <select name="mode" defaultValue={mode}>
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