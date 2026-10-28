"""Fast bulk writes for the workforce limit tests (500 people, 100 crews) with one HTTP session."""
from __future__ import annotations

from typing import Any

import requests
from robot.api.deco import keyword, library


@library(scope="GLOBAL", auto_keywords=False)
class WorkforceBulk:
    @keyword
    def bulk_post(self, api_url: str, token: str, path: str, template: dict, count: Any, name_key: str = "") -> list:
        """POST ``count`` copies of ``template`` (numbered ``name_key`` when given). Returns the failures."""
        failures = []
        with requests.Session() as s:
            s.headers["Authorization"] = f"Bearer {token}"
            for i in range(int(count)):
                body = dict(template)
                if name_key:
                    body[name_key] = f"bulk-{i:04d}"
                r = s.post(api_url + path, json=body, timeout=60)
                if r.status_code != 201:
                    failures.append((i, r.status_code, r.text[:120]))
                    break
        return failures

    @keyword
    def parallel_put(self, api_url: str, token: str, path: str, bodies: list) -> list:
        """PUT every body to ``path`` at the same moment (one thread each). Returns the status codes."""
        from concurrent.futures import ThreadPoolExecutor

        def one(body: dict) -> int:
            return requests.put(api_url + path, json=body, headers={"Authorization": f"Bearer {token}"}, timeout=60).status_code

        with ThreadPoolExecutor(len(bodies)) as pool:
            return list(pool.map(one, bodies))
