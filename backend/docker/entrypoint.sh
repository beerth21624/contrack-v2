#!/bin/sh
# ─── contrack-api container start: migrate, seed the demo data once, then run the API ───
# SEED_DEMO=true (the image default) puts the demo accounts and the showcase house into an EMPTY database only (no demo
# owner yet), so a restart never overwrites what people changed. The demo password is public (backend/SEED.md):
# set SEED_DEMO=false for anything that is not a dev / demo environment.
set -e
cd /app/backend

echo "contrack-api: applying database migrations"
node dist/backend/src/shared/infrastructure/database/migrate.js

if [ "${SEED_DEMO:-false}" = "true" ]; then
    if node docker/demo-seeded.cjs; then
        echo "contrack-api: demo data already present, not seeding"
    else
        echo "contrack-api: seeding demo accounts and projects"
        node dist/backend/src/cli/seed-demo.js
        echo "contrack-api: seeding the showcase house (crews, plan, revisions)"
        node dist/backend/src/cli/seed-showcase.js --in-process
    fi
fi

echo "contrack-api: starting on port ${PORT:-4000}"
exec node dist/backend/src/main.js
