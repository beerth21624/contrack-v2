"""Run-time settings. Override any of them on the command line: ``robot -v BASE_URL:http://localhost:3000 …``."""
import os

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:3200")
API_URL = os.environ.get("E2E_API_URL", "http://localhost:4200")
DATABASE_URL = os.environ.get("E2E_DATABASE_URL", "postgres://contrack:contrack@localhost:5432/contrack_e2e")
BROWSER = os.environ.get("E2E_BROWSER", "chromium")
HEADLESS = os.environ.get("E2E_HEADLESS", "true").lower() != "false"
SLOW_MO = os.environ.get("E2E_SLOW_MO", "0ms")
TIMEOUT = os.environ.get("E2E_TIMEOUT", "20s")

# Accounts created by `npm run db:seed` in backend/ (backend/SEED.md). Local test data only.
DEMO_PASSWORD = "ContrackDemo#2026"
DEMO_OWNER = "owner@contrack.test"
DEMO_ADMIN = "admin@contrack.test"
DEMO_ESTIMATOR = "estimator@contrack.test"
DEMO_VIEWER = "viewer@contrack.test"
DEMO_SOLO = "solo@contrack.test"
DEMO_COMPANY = "บริษัท ตัวอย่างก่อสร้าง จำกัด"

# Password used for users the suites register themselves.
TEST_PASSWORD = "RobotTest#2026"

# Module ids in contract order (src/shared/contract/modules.ts MODULE_IDS) and the ones the E2E server offers
# (MODULES_ENABLED in env/backend.e2e.env).
MODULE_IDS = [
    "subcontracting", "materials", "owner-leads", "ai-assist", "workforce",
    # ERP (WP-03): listed by GET /workspaces/:id/modules; not offered by the E2E server (available false)
    "project-hub", "portal", "boq-control", "quotations", "contracts", "billing", "variations",
    "procurement", "site-diary", "labour", "job-cost", "payables", "handover",
]
# Rows of the /workspace/modules page: ERP modules the server does not offer are hidden there (D-50), so the page
# shows the legacy modules only.
LEGACY_MODULE_IDS = MODULE_IDS[:5]
OFFERED_MODULES = ["subcontracting", "workforce"]
