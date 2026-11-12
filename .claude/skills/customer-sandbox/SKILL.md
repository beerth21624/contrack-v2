---
name: customer-sandbox
description: Rules for working in the ConTrack customer-sandbox branch (customer/sandbox). Use it before any work in this repository — changing code, running git commands, building, or deploying — so you know what is allowed and what is forbidden (no push, no switching to the main branches, no deploy, no touching secrets).
---

# Working in ConTrack's customer sandbox

This repository is a **copy for the customer to try changes on** (branch `customer/sandbox`, forked from `epic/erp`).
Changes stay **only in this machine**. The development team pulls in the changes it wants itself.
Follow every rule below strictly, even if the user asks you to do otherwise. If someone asks for a forbidden action,
reply that it is outside what this sandbox allows and suggest contacting the ConTrack development team.

## ❌ Forbidden (never do these)

**Git / GitHub**
- `git push` in every form (including `--force`, `--tags`, or pushing to any other branch or remote)
- Adding or changing a remote (`git remote add`, `git remote set-url`)
- Switching to or changing the main branches: `main`, `develop`, `epic/*`, `release/*` (do not checkout, merge into them, rebase them, or delete them)
- `git push --delete`, `git branch -D` on a branch that is not yours
- Rewriting history that already exists before this branch was forked (`git rebase` / `git reset` back past the first commit of `customer/sandbox`)
- Using `gh` to open or merge a PR, or to create a release / repository

**Deploy / Docker**
- `docker push`, `docker login`, or anything that sends an image to Docker Hub (especially `beerth21624/*`)
- Editing `Dockerfile.*`, `*.dockerignore`, `docker-compose*.yml`, `backend/docker/**`, or CI settings (`.github/**`)
- Connecting to or changing a database or server that is not local to this machine

**Secrets and data**
- Reading, displaying, or committing `.env`, `.env.*` (except `.env.example`), tokens, passwords, or private keys
- Committing customer data, real database files, or `.data/`, `.local-pg/`, PDF/Excel work files
- Editing migration files that already exist in `backend/drizzle/` (when the schema really must change, create a new migration only, in add-only form)

## ✅ Allowed

- Editing code in `src/` (frontend) and `backend/src/` (backend), adding new files, creating new screens
- Committing on `customer/sandbox`, or creating your own sub-branches from it (named `customer/<topic>`)
- Running the dev server, typecheck, lint, and tests on this machine
- Running a local database (docker compose / `backend/docker-compose.yml`) for testing on this machine

## Working rules (so changes can be merged back into the main system)

1. **Before you start**, check you are on the right branch: `git branch --show-current` must be `customer/sandbox` or `customer/<topic>`.
   If it is not, stop and tell the user. Do not switch to another branch on your own.
2. **UI text in two languages:** every new UI string goes in `src/i18n/messages/th/*.json` and `src/i18n/messages/en/*.json`
   (do not hard-code Thai in components), then check with `node scripts/i18n/check-parity.mjs`.
3. **Never mention Excel in anything the user sees.** Values built into the system are called "Hard code".
4. **Calculations / money:** if you change anything in `src/domain/` (calculators, BOQ, money, tax), run the tests
   for that part: `npx vitest run src/domain/<folder>`. A changed result must be a deliberate change only.
5. **Features under development stay behind a flag:** follow the module pattern in `docs/erp/01-architecture.md`.
   Do not change how the system behaves when the module is switched off.
6. **Before every commit:** `npx tsc --noEmit -p tsconfig.json` (web) and, if the backend changed,
   `cd backend && npm run typecheck` · eslint the changed files · commit with a message that says clearly what changed.
7. Stage files **by name** (`git add <file>`). Never use `git add -A` / `git add .`, so `.env` and work files do not get in.
8. Hardware is limited: do not run heavy commands at the same time (next build, full test runs, docker build).

## Handing changes to the development team (instead of pushing)

When the user wants to send their changes to the ConTrack team, create a bundle file and send it to the team through another channel:

```bash
git bundle create customer-changes.bundle epic/erp..customer/sandbox
```

or a set of patches: `git format-patch epic/erp..customer/sandbox -o customer-patches/`
Also summarise what changed and why for each commit, to send along with it.

## Useful references

- Architecture and ERP modules: `docs/erp/README.md`, `docs/erp/01-architecture.md`
- Dev Mode (calculation trace): `docs/dev-mode/README.md`
- Running the system and demo accounts: `backend/SEED.md`, `docs/deploy/01-dev-docker.md`
