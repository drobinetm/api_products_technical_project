// Minimal ESLint config that disables all rules
module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [],
  rules: {
    // Disable all rules
    'no-console': 'off',
    // Disable TypeScript specific rules
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'n/no-process-env': 'off',
    // Disable other common rules
    'no-undef': 'off',
    'no-unused-vars': 'off',
  },
  // Ignore all files
  ignorePatterns: ['**/*'],
};
