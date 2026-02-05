import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/lib/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        '.next/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/types/**',
      ],
      thresholds: {
        // Baseline thresholds for current coverage; raise as coverage improves.
        lines: 12,
        functions: 16,
        branches: 9,
        statements: 12,
      },
    },
  },
});
