#!/usr/bin/env python3
"""
Concurrency Load Test (`scripts/load_test.py`)
Fires 50 simultaneous same-issue citizen reports against CivicResolve (`/api/igmer`),
then asserts:
  1. All 50 citizen reports are preserved (`persistedReportsCount == 50`)
  2. Concurrency-safe advisory locking produces exactly 1 master incident (`masterIncidentsCreated == 1`)
  3. Master incident `supportingReportCount == 50`
"""
from __future__ import annotations

import json
import sys
import urllib.request


def run_50_concurrent_load_test(base_url: str = "http://localhost:3000") -> None:
    url = f"{base_url.rstrip('/')}/api/igmer"
    payload = json.dumps(
        {
            "action": "SIMULATE_50",
            "scenario": "SINGLE_INCIDENT_50",
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    sim = body["simulationResult"]
    persisted = int(sim["persistedReportsCount"])
    masters_created = int(sim["masterIncidentsCreated"])
    report_count = int(sim["masterIncidents"][0]["supportingReportCount"])

    print(
        f"[load_test] Submitted=50 | Persisted={persisted} | "
        f"MasterIncidents={masters_created} | report_count={report_count} | "
        f"Duration={sim['durationMs']}ms"
    )

    assert persisted == 50, f"Expected 50 preserved reports, got {persisted}"
    assert masters_created == 1, f"Expected exactly 1 master incident, got {masters_created}"
    assert report_count == 50, f"Expected report_count == 50, got {report_count}"
    print("[load_test] PASS: 50 concurrent reports preserved into 1 master incident.")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    run_50_concurrent_load_test(target)
