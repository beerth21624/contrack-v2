import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ── Strict type-checked rules ──────────────────────────────────
  ...tseslint.configs.strictTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
  })),

  // ── Language options for type-aware linting ────────────────────
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Custom rule overrides (warn-first for gradual adoption) ───
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    rules: {
      // --- TypeScript strict rules (warn to allow gradual adoption) ---
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        { checksVoidReturn: { attributes: false } },
      ],

      // --- Unsafe rules as warn (gradual migration from `any`) ---
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",

      // --- Too noisy for this codebase, disable ---
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",

      // --- General best practices ---
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  // ── ERP code: no hard-coded Thai text (docs/erp/03-i18n.md §8) ──
  // Every UI text comes from the message files (src/i18n/messages/*). Track I adds the globs of the old screens
  // here once they are moved. Globs of folders that do not exist yet are fine.
  {
    files: [
      "src/features/erp/**/*.{ts,tsx}",
      "src/app/(public)/**/*.{ts,tsx}",
      "src/app/(print)/**/*.{ts,tsx}",
      "src/app/(app)/{hub,home,p,customers,receivables,purchasing,suppliers,payables,tax-reports,finance,approvals,admin}/**/*.{ts,tsx}",
      "src/app/(app)/workspace/{company,numbering,approval-policies,pay-periods}/**/*.{ts,tsx}",
      // Track I-01: app shell, account, auth, errors
      "src/components/AppLayoutUI.tsx",
      "src/features/cloud/{ui,auth}/**/*.{ts,tsx}",
      "src/features/modules/**/*.{ts,tsx}",
      "src/features/notifications/**/*.{ts,tsx}",
      "src/features/cloud/api/errors.ts",
      "src/store/{project-store,notice-texts}.ts",
      "src/app/(app)/{login,register,invite,calc}/**/*.{ts,tsx}",
      // Track I-02: sheet components (journey/ is I-03)
      "src/components/sheet/*.{ts,tsx}",
      // Track I-03: journey components
      "src/components/sheet/journey/*.{ts,tsx}",
      // Track I-04: BOQ home + journey pages (tests keep Thai sample data)
      "src/features/boq-home/**/*.{ts,tsx}",
      "src/features/journey/**/*.{ts,tsx}",
    ],
    ignores: ["**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/[\u0E00-\u0E7F]/]",
          message: "No Thai text in ERP code: put it in src/i18n/messages (th + en) and use useTranslations / getTranslations.",
        },
        {
          selector: "TemplateElement[value.raw=/[\u0E00-\u0E7F]/]",
          message: "No Thai text in ERP code: put it in src/i18n/messages (th + en) and use useTranslations / getTranslations.",
        },
        {
          selector: "JSXText[value=/[\u0E00-\u0E7F]/]",
          message: "No Thai text in ERP code: put it in src/i18n/messages (th + en) and use useTranslations / getTranslations.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "backend/**",
  ]),
]);

export default eslintConfig;
