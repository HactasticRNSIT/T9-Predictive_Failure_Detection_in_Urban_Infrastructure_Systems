"""
Seed script: Upload assets.json data into Supabase.
Run once after creating the tables.
Usage: python seed_supabase.py
"""
import json
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY in backend/.env")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Load local assets
with open(os.path.join(os.path.dirname(__file__), "data", "assets.json"), "r") as f:
    assets = json.load(f)

print(f"Found {len(assets)} assets to seed...")

# Transform keys to snake_case for Supabase
rows = []
for a in assets:
    rows.append({
        "id": a["id"],
        "name": a["name"],
        "type": a["type"],
        "lat": a["lat"],
        "lng": a["lng"],
        "age": a["age"],
        "max_age": a["maxAge"],
        "load": a["load"],
        "inspection_score": a["inspectionScore"],
        "last_maintenance": a["lastMaintenance"],
        "history": json.dumps(a.get("history", []))
    })

# Upsert (insert or update) all assets
result = supabase.table("assets").upsert(rows).execute()
print(f"✅ Successfully seeded {len(rows)} assets into Supabase!")
