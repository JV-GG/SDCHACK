"""
Test isolation: every pytest run uses a fresh temporary SQLite database and never touches Neon,
so tests neither depend on nor modify the demo data in backend/data/grant_copilot.db.
Must run before any `app` module is imported, which conftest.py guarantees.
"""
import os
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="grant-copilot-tests-")
os.environ["GRANT_COPILOT_DB_PATH"] = os.path.join(_tmp_dir, "test.db")
os.environ["DATABASE_URL"] = ""  # disables the Neon mirror (_neon_http_sql returns None)
os.environ["SCHEDULED_SCAN_INTERVAL_HOURS"] = "0"
