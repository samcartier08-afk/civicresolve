"""
Seeds synthetic Chennai / Tamil Nadu jurisdiction rules and sample civic incidents.
All seeded rows are explicitly marked `is_synthetic = True`.
"""
from __future__ import annotations

CHENNAI_SYNTHETIC_SEED = [
    {
        "ward_code": "GCC-W101",
        "ward_name": "Ward 101 — Anna Nagar East",
        "zone_name": "Zone 8 (Anna Nagar)",
        "category_group": "Water & Drainage",
        "department_name": "Chennai MetroWater (CMWSSB) — Water Supply & Sewerage",
        "sla_hours": 6,
        "is_synthetic": True,
    },
    {
        "ward_code": "GCC-W126",
        "ward_name": "Ward 126 — Mandaveli / Mylapore",
        "zone_name": "Zone 9 (Teynampet)",
        "category_group": "Streetlights & Electricity",
        "department_name": "TANGEDCO — Streetlighting & Electrical Distribution",
        "sla_hours": 4,
        "is_synthetic": True,
    },
    {
        "ward_code": "GCC-W136",
        "ward_name": "Ward 136 — T. Nagar / Pondy Bazaar",
        "zone_name": "Zone 10 (Kodambakkam)",
        "category_group": "Roads & Potholes",
        "department_name": "Greater Chennai Corporation (GCC) — Storm Water Drain & Roads",
        "sla_hours": 24,
        "is_synthetic": True,
    },
    {
        "ward_code": "GCC-W173",
        "ward_name": "Ward 173 — Adyar / Besant Nagar",
        "zone_name": "Zone 13 (Adyar)",
        "category_group": "Waste & Sanitation",
        "department_name": "GCC Solid Waste Management & Conservancy",
        "sla_hours": 12,
        "is_synthetic": True,
    },
]

if __name__ == "__main__":
    print(f"Prepared {len(CHENNAI_SYNTHETIC_SEED)} synthetic Chennai jurisdiction rules (is_synthetic=True).")
