"""Read-only checks against the E2E PostgreSQL database (``contrack_e2e``), plus a guarded full reset.

Tests verify what the API wrote by reading the rows back. Every query is parameterised (``%s``). Writes are
limited to ``Reset E2E Database``, which refuses any database whose name does not end in ``_e2e``.
"""
from __future__ import annotations

import os
from typing import Any

import psycopg
from psycopg.rows import dict_row
from robot.api import logger
from robot.api.deco import keyword, library

DEFAULT_URL = "postgres://contrack:contrack@localhost:5432/contrack_e2e"


@library(scope="GLOBAL", auto_keywords=False)
class ContrackDb:
    def __init__(self, url: str | None = None) -> None:
        self.url = url or os.environ.get("E2E_DATABASE_URL", DEFAULT_URL)

    def _conn(self) -> psycopg.Connection:
        return psycopg.connect(self.url, row_factory=dict_row, autocommit=True)

    @keyword
    def set_database_url(self, url: str) -> None:
        self.url = url

    @keyword
    def query_rows(self, sql: str, *params: Any) -> list[dict]:
        """Rows as dictionaries. ``Query Rows    select * from users where email = %s    ${email}``."""
        with self._conn() as c, c.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else []
        logger.info(f"{sql} {params} → {len(rows)} row(s)")
        return [dict(r) for r in rows]

    @keyword
    def query_row(self, sql: str, *params: Any) -> dict:
        """Exactly one row (fails on 0 or more than 1)."""
        rows = self.query_rows(sql, *params)
        if len(rows) != 1:
            raise AssertionError(f"Expected 1 row, got {len(rows)}: {sql} {params}")
        return rows[0]

    @keyword
    def query_value(self, sql: str, *params: Any) -> Any:
        """First column of the single row (``select count(*) …``)."""
        row = self.query_row(sql, *params)
        return next(iter(row.values()))

    @keyword
    def row_count_should_be(self, expected: Any, sql: str, *params: Any) -> None:
        n = len(self.query_rows(sql, *params))
        if n != int(expected):
            raise AssertionError(f"Expected {expected} row(s), got {n}: {sql} {params}")

    @keyword
    def table_columns(self, table: str) -> list[str]:
        rows = self.query_rows(
            "select column_name from information_schema.columns where table_schema = 'public' and table_name = %s "
            "order by ordinal_position", table)
        return [r["column_name"] for r in rows]

    @keyword
    def reset_e2e_database(self) -> None:
        """Truncate every application table (keeps the schema and migrations). Only on a ``*_e2e`` database."""
        with self._conn() as c, c.cursor() as cur:
            cur.execute("select current_database() as db")
            db = cur.fetchone()["db"]
            if not db.endswith("_e2e"):
                raise AssertionError(f"Refusing to reset database {db!r} (name must end in _e2e)")
            cur.execute("select tablename from pg_tables where schemaname = 'public'")
            tables = [r["tablename"] for r in cur.fetchall()]
            if tables:
                cur.execute("truncate table " + ", ".join(f'public."{t}"' for t in tables) + " restart identity cascade")
        logger.info(f"Reset {db}: {len(tables)} tables truncated")
