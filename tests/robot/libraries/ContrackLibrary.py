"""Helpers shared by every ConTrack suite: unique test data, Thai number parsing, and expected values.

Expected values come from the real BOQ engine (``tests/robot/tools/expected.ts``), which the vitest golden and
oracle tests check against the Excel v5 workbook. A UI test types inputs, reads the screen, and compares it with
``Compute Expected`` on the same project, so the E2E suite never hard-codes a number it cannot explain.
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import uuid
from pathlib import Path
from typing import Any

from robot.api import logger
from robot.api.deco import keyword, library

ROOT = Path(__file__).resolve().parents[3]          # repo root
TOOL = ROOT / "tests" / "robot" / "tools" / "expected.ts"
TSX = ROOT / "backend" / "node_modules" / ".bin" / ("tsx.cmd" if os.name == "nt" else "tsx")
GUEST_PROJECT_KEY = "contrack-project"
PROJECT_SCHEMA_VERSION = 1


@library(scope="GLOBAL", auto_keywords=False)
class ContrackLibrary:
    """Keywords used across the API, DB and UI suites."""

    # ── unique test data ──────────────────────────────────────────────────────────
    @keyword
    def unique_suffix(self) -> str:
        """Short random suffix, safe in e-mails and names (parallel runs never collide)."""
        return uuid.uuid4().hex[:10]

    @keyword
    def unique_email(self, prefix: str = "robot") -> str:
        """``<prefix>.<random>@robot.test`` (the ``.test`` TLD never delivers mail)."""
        return f"{prefix}.{self.unique_suffix()}@robot.test"

    @keyword
    def unique_name(self, prefix: str = "โครงการทดสอบ") -> str:
        return f"{prefix} {self.unique_suffix()}"

    @keyword
    def unique_thai_phone(self) -> str:
        """A syntactically valid Thai mobile number (08 + 8 digits) that is unlikely to repeat."""
        digits = str(uuid.uuid4().int)[:8]
        return f"08{digits}"

    # ── numbers ───────────────────────────────────────────────────────────────────
    @keyword
    def parse_thai_number(self, text: Any) -> float:
        """'1,848,262 บาท' → 1848262.0, '−12.5' → -12.5, '12.5%' → 12.5, '-' / '' → 0.0."""
        if isinstance(text, (int, float)):
            return float(text)
        s = str(text).replace("−", "-").replace(",", "").replace("\xa0", " ")
        m = re.search(r"-?\d+(?:\.\d+)?", s)
        if not m:
            if s.strip() in ("", "-", "–", "—"):
                return 0.0
            raise AssertionError(f"No number in {text!r}")
        return float(m.group(0))

    @keyword
    def numbers_should_be_close(self, actual: Any, expected: Any, tolerance: Any = 0.01, msg: str | None = None) -> None:
        """|actual − expected| ≤ tolerance (both may be Thai-formatted text). Default tolerance: one satang."""
        a, e, t = self.parse_thai_number(actual), self.parse_thai_number(expected), float(tolerance)
        if math.isnan(a) or abs(a - e) > t:
            raise AssertionError(msg or f"{a} != {e} (tolerance {t})")

    @keyword
    def format_baht(self, value: Any, digits: int = 0) -> str:
        """1855162.248 → '1,855,162' (digits=0) or '1,855,162.25' (digits=2)."""
        return f"{float(value):,.{int(digits)}f}"

    # ── expected values from the BOQ engine ─────────────────────────────────────────
    def _run_tool(self, args: list[str], stdin: str | None = None) -> dict:
        if not TSX.exists():
            raise AssertionError(f"tsx not found at {TSX}: run `npm ci` in backend/")
        proc = subprocess.run(
            [str(TSX), "--tsconfig", str(ROOT / "tsconfig.json"), str(TOOL), *args],
            input=stdin, capture_output=True, text=True, encoding="utf-8", cwd=str(ROOT), timeout=180,
            shell=(os.name == "nt"),
        )
        if proc.returncode != 0:
            raise AssertionError(f"expected.ts failed ({proc.returncode}):\n{proc.stderr[-4000:]}")
        return json.loads(proc.stdout)

    @keyword
    def compute_expected(self, project: Any) -> dict:
        """Engine result for a project (dict, JSON text, or the localStorage value ``{state: {project}}``).

        Returns ``constructionTotal``, ``preConstructionTotal``, ``sections[]`` (no, title, mat, lab, total),
        ``levels[]`` (id, title, total, state, missing[]), ``planning`` and ``calcOutputs``.
        """
        text = project if isinstance(project, str) else json.dumps(project, ensure_ascii=False)
        return self._run_tool(["-"], stdin=text)

    @keyword
    def compute_expected_for_new_project(self, start: str = "sample") -> dict:
        """Engine result for ``createProject(start)`` ('blank' or 'sample'), the project the app makes."""
        return self._run_tool(["--create", start])

    @keyword
    def expected_level(self, expected: dict, level_id: str) -> dict:
        for lvl in expected["levels"]:
            if lvl["id"] == level_id:
                return lvl
        raise AssertionError(f"No journey level {level_id!r}")

    @keyword
    def expected_section(self, expected: dict, section_no: Any) -> dict:
        for s in expected["sections"]:
            if int(s["no"]) == int(section_no):
                return s
        raise AssertionError(f"No BOQ section {section_no!r}")

    # ── guest project in localStorage ────────────────────────────────────────────────
    @keyword
    def guest_storage_value(self, project: Any) -> str:
        """The localStorage value the app's zustand store reads for a guest project."""
        proj = json.loads(project) if isinstance(project, str) else project
        if isinstance(proj, dict) and "state" in proj:
            proj = proj["state"]["project"]
        return json.dumps({"state": {"project": proj}, "version": PROJECT_SCHEMA_VERSION}, ensure_ascii=False)

    @keyword
    def project_from_storage_value(self, value: Any) -> dict:
        """Inverse of ``Guest Storage Value``: the project object from the raw localStorage text."""
        if value in (None, "", "null"):
            raise AssertionError("No guest project in localStorage")
        data = json.loads(value) if isinstance(value, str) else value
        return data["state"]["project"] if "state" in data else data

    @keyword
    def level_ids(self) -> list[str]:
        """The 37 journey level ids in order (from the engine, so it follows ``levels.ts``)."""
        return [lvl["id"] for lvl in self.compute_expected_for_new_project("blank")["levels"]]

    @keyword
    def project_with_levels_done(self, project: Any, until_level: str, mark: str = "done") -> dict:
        """Copy of ``project`` with every level *before* ``until_level`` marked ``done`` (it unlocks that level).

        Levels already marked (done/skipped) keep their mark. Use ``until_level=ALL`` to mark all 37 levels.
        """
        proj = json.loads(json.dumps(project if not isinstance(project, str) else json.loads(project)))
        if "state" in proj:
            proj = proj["state"]["project"]
        journey = dict(proj.get("journey") or {})
        ids = self.level_ids()
        if until_level != "ALL" and until_level not in ids:
            raise AssertionError(f"No journey level {until_level!r}")
        for lid in ids:
            if lid == until_level:
                break
            journey.setdefault(lid, mark)
        proj["journey"] = journey
        return proj

    @keyword
    def load_project_fixture(self, name: str) -> dict:
        """``tests/robot/data/projects/<name>.json`` as a dict."""
        path = ROOT / "tests" / "robot" / "data" / "projects" / f"{name}.json"
        return json.loads(path.read_text(encoding="utf-8"))

    # ── SMS sent by the E2E backend (SMS_PROVIDER=console writes "SMS to +66…: text" to its log) ──────────
    @keyword
    def to_e164_thai(self, phone: str) -> str:
        """'0812345678' / '081-234-5678' → '+66812345678' (already E.164 stays)."""
        digits = re.sub(r"\D", "", str(phone))
        if str(phone).strip().startswith("+"):
            return "+" + digits
        if digits.startswith("0"):
            return "+66" + digits[1:]
        if digits.startswith("66"):
            return "+" + digits
        return "+66" + digits

    @keyword
    def sms_messages_to(self, phone: str) -> list[str]:
        """Every SMS text the E2E backend 'sent' to ``phone`` (oldest first). Log: ``E2E_API_LOG`` or
        ``tests/robot/logs/e2e-api.log``."""
        log = Path(os.environ.get("E2E_API_LOG", str(ROOT / "tests" / "robot" / "logs" / "e2e-api.log")))
        if not log.exists():
            raise AssertionError(f"Backend log {log} not found: start the E2E API with its output in that file")
        target = self.to_e164_thai(phone)
        text = log.read_text(encoding="utf-8", errors="replace")
        text = re.sub(r"\x1b\[[0-9;]*m", "", text)       # strip ANSI colours of the Nest logger
        return re.findall(r"SMS to " + re.escape(target) + r": (.*)", text)

    @keyword
    def latest_sms_to(self, phone: str, timeout: Any = 10) -> str:
        """Newest SMS text to ``phone``; waits up to ``timeout`` seconds for one to appear."""
        import time
        deadline = time.time() + float(timeout)
        while True:
            msgs = self.sms_messages_to(phone)
            if msgs:
                return msgs[-1].strip()
            if time.time() > deadline:
                raise AssertionError(f"No SMS to {self.to_e164_thai(phone)} in the backend log")
            time.sleep(0.25)

    @keyword
    def latest_otp_to(self, phone: str, timeout: Any = 10) -> str:
        """The 6-digit code in the newest SMS to ``phone``."""
        msg = self.latest_sms_to(phone, timeout)
        m = re.search(r"\b(\d{6})\b", msg)
        if not m:
            raise AssertionError(f"No 6-digit code in SMS: {msg!r}")
        return m.group(1)

    @keyword
    def guest_project_key(self) -> str:
        return GUEST_PROJECT_KEY

    @keyword
    def log_json(self, value: Any, title: str = "") -> None:
        logger.info(f"{title}\n{json.dumps(value, ensure_ascii=False, indent=2)[:20000]}")
