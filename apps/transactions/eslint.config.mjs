import { baseConfig } from '@tech-challenge/config/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: './tsconfig.json',
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'generated/**',
      'eslint.config.mjs',
      '.prettierrc.mjs',
      'vitest.config.mts',
    ],
  },
];
