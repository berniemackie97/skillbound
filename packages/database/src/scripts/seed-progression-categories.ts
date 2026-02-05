#!/usr/bin/env node

/**
 * Seed progression categories
 * Run with: tsx src/scripts/seed-progression-categories.ts
 */

import { createDbClient } from '../client.js';
import { PROGRESSION_CATEGORIES } from '../data/progression-templates.js';
import { progressionCategories } from '../schema/progression/progression.js';

async function seedProgressionCategories() {
  const connectionString = process.env['DATABASE_URL'];

  if (!connectionString) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const db = createDbClient({ connectionString });

  console.warn('Seeding progression categories...');

  try {
    // Check if categories already exist
    const existing = await db.select().from(progressionCategories).limit(1);

    if (existing.length > 0) {
      console.warn(
        'Progression categories already exist. Skipping seed operation.'
      );
      console.warn(
        'Run this script with --force to re-seed (not implemented).'
      );
      return;
    }

    // Insert all categories
    const now = new Date();
    const categoriesToInsert = PROGRESSION_CATEGORIES.map((category) => {
      const defaultItems = category.defaultItems ?? [];
      return {
        name: category.name,
        description: category.description,
        icon: category.icon,
        orderIndex: category.orderIndex,
        defaultItems,
        createdAt: now,
        updatedAt: now,
      };
    });

    const inserted = await db
      .insert(progressionCategories)
      .values(categoriesToInsert)
      .returning();

    console.warn(
      `✓ Successfully seeded ${inserted.length} progression categories`
    );

    inserted.forEach((cat) => {
      const items = Array.isArray(cat.defaultItems) ? cat.defaultItems : [];
      console.warn(
        `  - ${cat.icon} ${cat.name} (${items.length} default items)`
      );
    });

    console.warn('\nCategories seeded successfully!');
  } catch (error) {
    console.error('Error seeding progression categories:', error);
    process.exit(1);
  }

  process.exit(0);
}

void seedProgressionCategories();
