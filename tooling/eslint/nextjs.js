/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['./react.js'],
  plugins: ['@next/next'],
  rules: {
    // Core Web Vitals rules from next/core-web-vitals
    '@next/next/no-html-link-for-pages': 'off',
    '@next/next/no-sync-scripts': 'error',
    '@next/next/no-img-element': 'warn',
    '@next/next/no-head-import-in-document': 'error',
    '@next/next/no-duplicate-head': 'error',
  },
};
