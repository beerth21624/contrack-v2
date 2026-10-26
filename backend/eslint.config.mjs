// Strict, type-aware lint for the backend (same spirit as the frontend config).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist/**', 'drizzle/**', 'node_modules/**', 'eslint.config.mjs', 'jest.config.js', 'test/jest-*.config.js'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
            // Nest modules and DI tokens are classes with only decorators / abstract members.
            '@typescript-eslint/no-extraneous-class': 'off',
            '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
        },
    },
    {
        files: ['**/*.spec.ts', 'test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
        },
    },
);
