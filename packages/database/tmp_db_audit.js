const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://skillbound:skillbound@localhost:5432/skillbound_dev',
});

const tables = [
  'character_profiles',
  'user_characters',
  'character_snapshots',
  'character_overrides',
  'guide_progress',
  'character_progression_items',
  'boss_killcounts',
  'collection_log_items',
  'gear_progression',
  'milestones',
  'character_state',
  'ge_trades',
  'ge_watch_items',
  'user_settings',
];

const orphanChecks = [
  { table: 'user_characters', col: 'profile_id', ref: 'character_profiles', refcol: 'id' },
  { table: 'character_snapshots', col: 'profile_id', ref: 'character_profiles', refcol: 'id' },
  { table: 'character_overrides', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'guide_progress', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'character_progression_items', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'boss_killcounts', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'collection_log_items', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'gear_progression', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'milestones', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'character_state', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'ge_trades', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'ge_watch_items', col: 'user_character_id', ref: 'user_characters', refcol: 'id' },
  { table: 'user_settings', col: 'active_character_id', ref: 'user_characters', refcol: 'id' },
];

(async () => {
  await client.connect();

  const tableRes = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
  );
  const existing = new Set(tableRes.rows.map((r) => r.table_name));
  const missing = tables.filter((t) => !existing.has(t));
  console.log('tables_missing', missing);

  const counts = {};
  for (const table of tables) {
    if (!existing.has(table)) continue;
    const res = await client.query(`SELECT count(*)::int AS count FROM \"${table}\";`);
    counts[table] = res.rows[0].count;
  }
  console.log('counts', counts);

  const fkRes = await client.query(
    "SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' ORDER BY tc.table_name, kcu.column_name;"
  );
  const fksByTable = {};
  for (const row of fkRes.rows) {
    if (!fksByTable[row.table_name]) fksByTable[row.table_name] = [];
    fksByTable[row.table_name].push(
      `${row.column_name}->${row.foreign_table_name}.${row.foreign_column_name}`
    );
  }
  console.log('fks', fksByTable);

  for (const check of orphanChecks) {
    if (!existing.has(check.table)) continue;
    const res = await client.query(
      `SELECT count(*)::int AS orphans FROM \"${check.table}\" t LEFT JOIN \"${check.ref}\" r ON t.\"${check.col}\"=r.\"${check.refcol}\" WHERE t.\"${check.col}\" IS NOT NULL AND r.\"${check.refcol}\" IS NULL;`
    );
    console.log('orphans', check.table, check.col, res.rows[0].orphans);
  }

  await client.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
