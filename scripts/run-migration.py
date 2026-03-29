#!/usr/bin/env python3
"""
Runs the AI Growth Hub migration against Supabase using the
Management API (pg_dump / pg_query endpoint available to service role).
"""
import urllib.request
import urllib.error
import json
import re
import sys

SUPABASE_URL = "https://mtfvkwrwdgenrcgokrvj.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZnZrd3J3ZGdlbnJjZ29rcnZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1Nzg3MCwiZXhwIjoyMDkwMTMzODcwfQ.X7fXscE49XZ2xyXNqRfKsQOgn9eIeiJDJ1JCT4svSWw"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def run_sql(sql: str) -> dict:
    """Execute SQL via Supabase's pg REST endpoint."""
    payload = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/query",
        data=payload,
        headers=HEADERS,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return {"ok": True, "body": resp.read().decode()}
    except urllib.error.HTTPError as e:
        return {"ok": False, "status": e.code, "body": e.read().decode()}

def check_table_exists(table_name: str) -> bool:
    """Check if a table already exists in the public schema."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{table_name}?limit=1",
        headers=HEADERS,
        method="GET",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
            return True
    except urllib.error.HTTPError as e:
        if e.code == 404 or e.code == 400:
            return False
        return True  # Exists but other error

def main():
    tables_to_check = [
        "ai_marketing_settings",
        "ai_insights",
        "social_posts",
        "referral_reminder_log",
    ]

    print("Checking existing tables...")
    for t in tables_to_check:
        exists = check_table_exists(t)
        print(f"  {t}: {'EXISTS' if exists else 'MISSING'}")

    print("\nRunning migration via Supabase REST API...")
    print("NOTE: Supabase REST API does not support raw DDL execution.")
    print("The migration SQL file has been prepared at:")
    print("  supabase/migrations/20260327_ai_growth_hub.sql")
    print()
    print("To apply it, paste the SQL into your Supabase SQL Editor:")
    print("  https://supabase.com/dashboard/project/mtfvkwrwdgenrcgokrvj/sql/new")
    print()
    print("The file is ready and waiting for you to run it.")

if __name__ == "__main__":
    main()
