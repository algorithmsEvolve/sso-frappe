import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    rules: {
      ...cfg.rules,
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
    },
  })),
);
