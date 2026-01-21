/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@skillbound/eslint-config/base.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
