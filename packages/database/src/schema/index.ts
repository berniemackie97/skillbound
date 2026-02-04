// Export all schemas

// Auth & User Management
export * from './auth/users';
export * from './auth/user-credentials';
export * from './auth/accounts';
export * from './auth/sessions';
export * from './auth/verification-tokens';
export * from './auth/authenticators';
export * from './auth/user-settings';

// Character Core
export * from './characters/characters';
export * from './characters/character-state'; // Unified state table (scalable sync)
export * from './characters/snapshots';
export * from './characters/overrides'; // Legacy - prefer character_state for new features

// Content & Guides
export * from './content/content-bundles';
export * from './content/guides';
export * from './content/content-definitions';

// Progression Tracking
export * from './progression/progression';
export * from './progression/progression-extended';

// Trading & Economy
export * from './trading/trading';

// Export progression templates
export * from '../data/progression-templates';
export * from '../data/boss-templates';
export * from '../data/gear-templates';
export * from '../data/milestone-templates';
