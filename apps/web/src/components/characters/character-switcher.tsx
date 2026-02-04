'use client';

import { useRef } from 'react';

type CharacterOption = {
  id: string;
  displayName: string;
  mode: string;
};

type CharacterSwitcherProps = {
  characters: CharacterOption[];
  activeCharacterId: string | null;
};

export function CharacterSwitcher({
  characters,
  activeCharacterId,
}: CharacterSwitcherProps) {
  const formRef = useRef<HTMLFormElement>(null);

  if (characters.length === 0) {
    return null;
  }

  return (
    <form
      ref={formRef}
      action="/api/characters/active"
      className="character-switcher"
      method="post"
    >
      <label>
        <span className="sr-only">Active character</span>
        <select
          name="characterId"
          value={activeCharacterId ?? ''}
          onChange={() => formRef.current?.submit()}
        >
          <option disabled value="">
            Select character…
          </option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.displayName} · {character.mode}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
