module.exports = {
  root: true,
  extends: ['curvenote'],
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.spec.tsx'],
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
  ],
};
