"""
Append-only organization audit log.

Every user and system action is written here by the backend (never by the browser) with a server
UTC timestamp, the company account email, the client IP and user agent. Each entry stores the hash
of the previous entry for the same organization, so editing or deleting any row breaks the chain
and `verify_chain` reports it.

SQLite is the authoritative chain; Neon Postgres receives a best-effort mirror copy.
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import Request

from app.models.schemas import AuditEventRecord, OrgAuditLogResponse
from app.services.db_service import _get_sqlite_conn, _neon_http_sql, get_organization

GENESIS_HASH = "0" * 64

CATEGORY_BY_EVENT: Dict[str, str] = {
    "ORG_REGISTERED": "AUTH",
    "LOGIN": "AUTH",
    "LOGIN_FAILED": "AUTH",
    "SESSION_RESUMED": "AUTH",
    "ORG_SWITCHED": "AUTH",
    "PROFILE_UPDATED": "PROFILE",
    "PASSWORD_CHANGED": "AUTH",
    "PASSWORD_CHANGE_FAILED": "AUTH",
    "DOCUMENT_SUBMITTED": "DOCUMENT",
    "DOCUMENT_AI_PARSED": "DOCUMENT",
    "CLAIM_EVALUATED": "EVALUATION",
    "NARRATIVES_DRAFTED": "EVALUATION",
    "CLAIM_APPROVED": "APPROVAL",
    "NARRATIVE_EDITED": "APPROVAL",
    "PACKET_GENERATED": "SUBMISSION",
    "GRANT_SUBMITTED": "SUBMISSION",
    "GRANT_CRAWL": "DISCOVERY",
    "OPPORTUNITY_SCAN": "DISCOVERY",
    "SCHEDULED_OPPORTUNITY_SCAN": "DISCOVERY",
}

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS audit_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL,
    claim_id TEXT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events (org_id, seq);
"""

_NEON_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    claim_id TEXT,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL
)
"""


def init_audit_store() -> None:
    with _get_sqlite_conn() as conn:
        conn.executescript(_SCHEMA_SQL)
    _neon_http_sql(_NEON_SCHEMA_SQL)


init_audit_store()


class AuditContext:
    """Who performed an action and from where. Built from the HTTP request on the server."""

    def __init__(self, ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        self.ip_address = ip_address
        self.user_agent = user_agent

    @classmethod
    def from_request(cls, request: Optional[Request]) -> "AuditContext":
        if request is None:
            return cls()
        # Behind a reverse proxy the client IP arrives in X-Forwarded-For (first hop). Note this header
        # can be set by the client when no trusted proxy overwrites it.
        forwarded = request.headers.get("x-forwarded-for")
        ip = forwarded.split(",")[0].strip() if forwarded else request.headers.get("x-real-ip")
        if not ip and request.client:
            ip = request.client.host
        ua = request.headers.get("user-agent")
        return cls(ip_address=ip or None, user_agent=(ua[:300] if ua else None))


def account_email(org_id: Optional[str]) -> Optional[str]:
    if not org_id:
        return None
    org = get_organization(org_id)
    return org.email if org else None


def actor_label(org_id: Optional[str], ctx: Optional[AuditContext] = None) -> str:
    """Human-readable actor for claim trail entries, e.g. 'finance@acme.my (company account) · 10.0.0.4'."""
    email = account_email(org_id) or "Unidentified session"
    label = f"{email} (company account)"
    return f"{label} · {ctx.ip_address}" if ctx and ctx.ip_address else label


def _hash_entry(fields: Dict[str, Any], prev_hash: str) -> str:
    payload = json.dumps({"prev": prev_hash, **fields}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


_HASHED_FIELDS = (
    "id", "org_id", "claim_id", "event_type", "category", "title", "description",
    "actor_type", "actor_email", "ip_address", "user_agent", "created_at",
)


def record_event(
    org_id: str,
    event_type: str,
    title: str,
    description: str = "",
    *,
    actor_type: str = "USER",
    ctx: Optional[AuditContext] = None,
    claim_id: Optional[str] = None,
    actor_email: Optional[str] = None,
) -> AuditEventRecord:
    """Appends one hash-chained event. USER events default the actor to the org's account email."""
    ctx = ctx or AuditContext()
    if actor_type == "USER" and actor_email is None:
        actor_email = account_email(org_id)
    fields = {
        "id": f"aud-{uuid.uuid4().hex[:12]}",
        "org_id": org_id,
        "claim_id": claim_id,
        "event_type": event_type,
        "category": CATEGORY_BY_EVENT.get(event_type, "OTHER"),
        "title": title,
        "description": description,
        "actor_type": actor_type,
        "actor_email": actor_email,
        "ip_address": ctx.ip_address if actor_type == "USER" else None,
        "user_agent": ctx.user_agent if actor_type == "USER" else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    conn = _get_sqlite_conn()
    try:
        conn.isolation_level = None
        conn.execute("BEGIN IMMEDIATE")  # serialise writers so the chain never forks
        row = conn.execute(
            "SELECT entry_hash FROM audit_events WHERE org_id = ? ORDER BY seq DESC LIMIT 1", (org_id,)
        ).fetchone()
        prev_hash = row["entry_hash"] if row else GENESIS_HASH
        entry_hash = _hash_entry(fields, prev_hash)
        conn.execute(
            f"INSERT INTO audit_events ({', '.join(_HASHED_FIELDS)}, prev_hash, entry_hash) "
            f"VALUES ({', '.join('?' for _ in _HASHED_FIELDS)}, ?, ?)",
            (*[fields[k] for k in _HASHED_FIELDS], prev_hash, entry_hash),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()

    _neon_http_sql(
        f"INSERT INTO audit_events ({', '.join(_HASHED_FIELDS)}, prev_hash, entry_hash) "
        f"VALUES ({', '.join(f'${i}' for i in range(1, len(_HASHED_FIELDS) + 3))}) ON CONFLICT (id) DO NOTHING",
        [*[fields[k] for k in _HASHED_FIELDS], prev_hash, entry_hash],
    )
    return _to_record({**fields, "prev_hash": prev_hash, "entry_hash": entry_hash})


def _to_record(r: Dict[str, Any]) -> AuditEventRecord:
    return AuditEventRecord(
        id=r["id"],
        orgId=r["org_id"],
        claimId=r.get("claim_id"),
        eventType=r["event_type"],
        category=r["category"],
        title=r["title"],
        description=r.get("description") or "",
        actorType=r["actor_type"],
        actorEmail=r.get("actor_email"),
        ipAddress=r.get("ip_address"),
        userAgent=r.get("user_agent"),
        createdAt=r["created_at"],
        prevHash=r["prev_hash"],
        entryHash=r["entry_hash"],
    )


def _rows_for_org(org_id: str) -> List[Dict[str, Any]]:
    with _get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_events WHERE org_id = ? ORDER BY seq ASC", (org_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def verify_chain(rows: List[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """Returns (valid, id of first broken entry). Rows must be oldest first."""
    prev = GENESIS_HASH
    for r in rows:
        fields = {k: r.get(k) for k in _HASHED_FIELDS}
        if r["prev_hash"] != prev or _hash_entry(fields, prev) != r["entry_hash"]:
            return False, r["id"]
        prev = r["entry_hash"]
    return True, None


def list_org_events(org_id: str, limit: int = 200) -> OrgAuditLogResponse:
    rows = _rows_for_org(org_id)
    valid, _ = verify_chain(rows)
    newest_first = [_to_record(r) for r in reversed(rows[-limit:])] if limit > 0 else []
    return OrgAuditLogResponse(orgId=org_id, events=newest_first, totalEvents=len(rows), chainValid=valid)


def recently_recorded(org_id: str, event_type: str, within_seconds: int, ip_address: Optional[str] = None) -> bool:
    """True if the same event (from the same IP, when given) was already logged within the window."""
    since = (datetime.now(timezone.utc) - timedelta(seconds=within_seconds)).isoformat()
    query = "SELECT 1 FROM audit_events WHERE org_id = ? AND event_type = ? AND created_at >= ?"
    params: List[Any] = [org_id, event_type, since]
    if ip_address is not None:
        query += " AND ip_address = ?"
        params.append(ip_address)
    with _get_sqlite_conn() as conn:
        return conn.execute(query + " LIMIT 1", params).fetchone() is not None


def last_event(org_id: str, claim_id: Optional[str] = None) -> Optional[AuditEventRecord]:
    """Most recent event for the org, or for one claim of the org when claim_id is given."""
    with _get_sqlite_conn() as conn:
        if claim_id:
            row = conn.execute(
                "SELECT * FROM audit_events WHERE org_id = ? AND claim_id = ? ORDER BY seq DESC LIMIT 1",
                (org_id, claim_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM audit_events WHERE org_id = ? ORDER BY seq DESC LIMIT 1", (org_id,)
            ).fetchone()
    return _to_record(dict(row)) if row else None
