import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import httpx

from app.core.config import settings
from app.models.schemas import (
    ClaimsReadinessPackage,
    CrawlTriggerResponse,
    GrantSchemeMetadata,
    Invoice,
    LLMNarrative,
    OrganizationAccount,
    OrganizationLoginRequest,
    OrganizationRegisterRequest,
    SMEProfile,
    SubmittedGrantDBRecord,
    TriggerEventRecord,
)

LOCAL_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "grant_copilot.db"

OFFICIAL_MALAYSIAN_GRANT_CATALOG: List[Dict[str, Any]] = [
    {
        "grantId": "MDEC_MSME_DIGITAL",
        "grantName": "MSME Digital Grant MADANI (SME Digitalisation Grant)",
        "agency": "MDEC",
        "matchingPercentage": 50,
        "maxCoFundingMYR": 5000.0,
        "sourceUrl": "https://mdec.my/msmedigitalgrant",
        "criteriaSummary": "≥60% Malaysian equity, ≥6 mos tenure, ≥RM50k turnover, MDEC TSP vendor, Digital/e-Invoicing/ERP/HR scope.",
    },
    {
        "grantId": "SME_CORP_SAG",
        "grantName": "Smart Automation Grant (SAG)",
        "agency": "SME Corp",
        "matchingPercentage": 50,
        "maxCoFundingMYR": 1000000.0,
        "sourceUrl": "https://smecorp.gov.my/index.php/en/programmes1/2015-12-21-10-03-39/smart-automation-grant",
        "criteriaSummary": "≥51% Malaysian equity, ≥12 mos tenure, Non-GLC/MNC, within SME Corp size ceiling, Automation Hardware scope.",
    },
    {
        "grantId": "MATRADE_MDG",
        "grantName": "Market Development Grant (MDG)",
        "agency": "MATRADE",
        "matchingPercentage": 100,
        "maxCoFundingMYR": 300000.0,
        "sourceUrl": "https://www.matrade.gov.my/en/malaysian-exporters/services-for-exporters/exporters-development/market-development-grant-mdg",
        "criteriaSummary": "≥60% Malaysian equity, ≥12 mos tenure, Registered Active Exporter, Export Exhibition / Trade Fair scope.",
    },
    {
        "grantId": "HRD_CORP_SBL",
        "grantName": "HRD Corp SBL-Khas Digital & Technical Training Grant",
        "agency": "HRD Corp",
        "matchingPercentage": 100,
        "maxCoFundingMYR": 25000.0,
        "sourceUrl": "https://hrdcorp.gov.my/sbl-khas",
        "criteriaSummary": "≥51% Malaysian equity, ≥10 full-time Malaysian employees (Mandatory Levy Tier), ≥6 mos tenure, HR/Payroll or Workforce Training scope.",
    },
    {
        "grantId": "MIDA_DISF",
        "grantName": "MIDA Domestic Investment Strategic Fund (DISF) Automation",
        "agency": "MIDA",
        "matchingPercentage": 60,
        "maxCoFundingMYR": 500000.0,
        "sourceUrl": "https://www.mida.gov.my/forms-and-guidelines/manufacturing-sector",
        "criteriaSummary": "≥60% Malaysian equity, Manufacturing sector, ≥24 mos track record, Turnover ≥RM500k & Automation CapEx ≥RM250k.",
    },
    {
        "grantId": "MITI_INDUSTRY4WRD",
        "grantName": "MITI Industry4WRD Intervention Fund",
        "agency": "MITI",
        "matchingPercentage": 70,
        "maxCoFundingMYR": 500000.0,
        "sourceUrl": "https://www.miti.gov.my/index.php/pages/view/industry4WRD",
        "criteriaSummary": "≥60% Malaysian equity, Manufacturing SME, ≥36 mos tenure, combined Cyber-Physical Digital ERP + Automation Hardware scope.",
    },
    {
        "grantId": "CRADLE_CIP_SPARK",
        "grantName": "Cradle CIP Spark Tech Commercialisation Grant",
        "agency": "Cradle Fund",
        "matchingPercentage": 80,
        "maxCoFundingMYR": 150000.0,
        "sourceUrl": "https://www.cradle.com.my/cip-spark",
        "criteriaSummary": "≥51% Malaysian equity, 6–36 mos early-stage startup tenure window, Turnover ≤RM5M, Cloud ERP / SaaS commercialisation scope.",
    },
]

# Application timing per scheme. ROLLING schemes accept applications year-round until the
# allocation is exhausted; WINDOWED schemes only between opensAt and closesAt.
# NOTE: dates are illustrative demo values for the hackathon, not verified agency calendars.
# A production crawler would refresh these from each agency portal.
GRANT_APPLICATION_TIMING: Dict[str, Dict[str, Any]] = {
    "MDEC_MSME_DIGITAL": {"applicationMode": "ROLLING", "requiresPreApproval": True},
    "SME_CORP_SAG": {
        "applicationMode": "WINDOWED",
        "opensAt": "2026-07-01",
        "closesAt": "2026-11-06",
        "requiresPreApproval": True,
    },
    "MATRADE_MDG": {"applicationMode": "ROLLING", "requiresPreApproval": False},
    "HRD_CORP_SBL": {"applicationMode": "ROLLING", "requiresPreApproval": True},
    "MIDA_DISF": {"applicationMode": "ROLLING", "requiresPreApproval": True},
    "MITI_INDUSTRY4WRD": {
        "applicationMode": "WINDOWED",
        "opensAt": "2027-01-05",
        "closesAt": "2027-03-31",
        "requiresPreApproval": True,
    },
    "CRADLE_CIP_SPARK": {
        "applicationMode": "WINDOWED",
        "opensAt": "2026-09-01",
        "closesAt": "2026-12-15",
        "requiresPreApproval": True,
    },
}


def _scheme_from_row(r: Any) -> GrantSchemeMetadata:
    """Builds scheme metadata from a DB row, merging timing and spend categories from code."""
    from app.rules import RULES_BY_ID  # local import keeps module load order simple

    grant_id = str(r["grant_id"])
    timing = GRANT_APPLICATION_TIMING.get(grant_id, {})
    rule = RULES_BY_ID.get(grant_id)
    return GrantSchemeMetadata(
        grantId=grant_id,
        grantName=str(r["grant_name"]),
        agency=str(r["agency"]),
        matchingPercentage=int(r["matching_percentage"]),
        maxCoFundingMYR=float(r["max_co_funding_myr"]),
        sourceUrl=str(r["source_url"]),
        criteriaSummary=str(r["criteria_summary"]),
        isActive=bool(r["is_active"]),
        lastCrawledAt=str(r["last_crawled_at"]),
        applicationMode=timing.get("applicationMode", "ROLLING"),
        opensAt=timing.get("opensAt"),
        closesAt=timing.get("closesAt"),
        requiresPreApproval=bool(timing.get("requiresPreApproval", False)),
        eligibleCategories=list(rule.eligible_categories) if rule else [],
    )

DEFAULT_ORGS: List[Dict[str, Any]] = [
    {
        "id": "org-nusantara",
        "email": "finance@nusantara.com.my",
        "passwordHash": "demo123",
        "company": {
            "companyName": "Nusantara Retail Solutions Sdn Bhd",
            "registrationNumber": "202101045892",
            "incorporationDate": "2021-04-15",
            "tenureMonths": 42,
            "malaysianEquityPercentage": 85.0,
            "annualTurnoverMYR": 480000.0,
            "fullTimeEmployees": 8,
            "sector": "SERVICES",
            "isGlcOrMncOwned": False,
            "isActiveExporter": False,
        },
        "defaultInvoice": {
            "invoiceNumber": "INV-MDEC-9082",
            "invoiceDate": "2026-10-18",
            "vendorName": "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
            "vendorIsMdecTsp": True,
            "totalAmountMYR": 10000.0,
            "items": [
                {
                    "id": "item-1",
                    "description": "LHDN e-Invoicing Compliance Module",
                    "category": "E_INVOICING",
                    "quantity": 1,
                    "unitPriceMYR": 6000.0,
                    "totalPriceMYR": 6000.0,
                },
                {
                    "id": "item-2",
                    "description": "Orbyte Payroll & Statutory EPF/SOCSO/PCB Cloud Module",
                    "category": "HR_PAYROLL",
                    "quantity": 1,
                    "unitPriceMYR": 4000.0,
                    "totalPriceMYR": 4000.0,
                },
            ],
        },
    },
    {
        "id": "org-precision-mfg",
        "email": "ops@precision-mfg.com.my",
        "passwordHash": "demo123",
        "company": {
            "companyName": "Penang Precision Robotics Sdn Bhd",
            "registrationNumber": "201801029384",
            "incorporationDate": "2018-06-10",
            "tenureMonths": 88,
            "malaysianEquityPercentage": 70.0,
            "annualTurnoverMYR": 6500000.0,
            "fullTimeEmployees": 45,
            "sector": "MANUFACTURING",
            "isGlcOrMncOwned": False,
            "isActiveExporter": True,
        },
        "defaultInvoice": {
            "invoiceNumber": "INV-AUTO-7740",
            "invoiceDate": "2026-10-20",
            "vendorName": "AseanTech Automation & Cloud Systems Sdn Bhd (MDEC TSP #0812)",
            "vendorIsMdecTsp": True,
            "totalAmountMYR": 280000.0,
            "items": [
                {
                    "id": "item-101",
                    "description": "6-Axis CNC Cobot Palletizing Cell & PLC Vision Sensor Suite",
                    "category": "AUTOMATION_HARDWARE",
                    "quantity": 1,
                    "unitPriceMYR": 255000.0,
                    "totalPriceMYR": 255000.0,
                },
                {
                    "id": "item-102",
                    "description": "MES Manufacturing Execution ERP & LHDN e-Invoicing Sync",
                    "category": "DIGITAL_ERP",
                    "quantity": 1,
                    "unitPriceMYR": 15000.0,
                    "totalPriceMYR": 15000.0,
                },
                {
                    "id": "item-103",
                    "description": "HRD Corp SBL-Khas Workforce Upskilling & Payroll System",
                    "category": "HR_PAYROLL",
                    "quantity": 1,
                    "unitPriceMYR": 10000.0,
                    "totalPriceMYR": 10000.0,
                },
            ],
        },
    },
    {
        "id": "org-kldigital",
        "email": "founder@kldigital.io",
        "passwordHash": "demo123",
        "company": {
            "companyName": "KL Digital Labs Sdn Bhd",
            "registrationNumber": "202501011223",
            "incorporationDate": "2025-02-01",
            "tenureMonths": 18,
            "malaysianEquityPercentage": 65.0,
            "annualTurnoverMYR": 320000.0,
            "fullTimeEmployees": 6,
            "sector": "SERVICES",
            "isGlcOrMncOwned": False,
            "isActiveExporter": False,
        },
        "defaultInvoice": {
            "invoiceNumber": "INV-SPARK-301",
            "invoiceDate": "2026-10-21",
            "vendorName": "CloudTech Malaysia Sdn Bhd (MDEC TSP #0421)",
            "vendorIsMdecTsp": True,
            "totalAmountMYR": 24000.0,
            "items": [
                {
                    "id": "item-201",
                    "description": "Cloud ERP Core Infrastructure & Commercialisation Stack",
                    "category": "DIGITAL_ERP",
                    "quantity": 1,
                    "unitPriceMYR": 18000.0,
                    "totalPriceMYR": 18000.0,
                },
                {
                    "id": "item-202",
                    "description": "LHDN MyInvois API Gateway Module",
                    "category": "E_INVOICING",
                    "quantity": 1,
                    "unitPriceMYR": 6000.0,
                    "totalPriceMYR": 6000.0,
                },
            ],
        },
    },
]


def _neon_http_sql(query: str, params: Optional[List[Any]] = None) -> Optional[List[Dict[str, Any]]]:
    """
    Executes SQL against Neon Serverless HTTP endpoint (`https://<host>/sql`).
    Returns rows as dicts if Neon is reachable, or None if offline/sandboxed.
    """
    db_url = settings.DATABASE_URL
    if not db_url or "neon.tech" not in db_url:
        return None
    try:
        parsed = urlparse(db_url)
        host = parsed.hostname
        if not host:
            return None
        endpoint = f"https://{host}/sql"
        clean_url = f"postgresql://{parsed.username}:{parsed.password}@{host}{parsed.path}?sslmode=require"
        payload: Dict[str, Any] = {"query": query}
        if params:
            payload["params"] = params
        with httpx.Client(timeout=2.0) as client:
            resp = client.post(
                endpoint,
                headers={
                    "Neon-Connection-String": clean_url,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("rows", [])
    except Exception:
        return None
    return None


def _get_sqlite_conn() -> sqlite3.Connection:
    LOCAL_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initializes local SQLite mirror and seeds default organizations & 7 grant schemes."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_sqlite_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                company_json TEXT NOT NULL,
                default_invoice_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS grant_schemes (
                grant_id TEXT PRIMARY KEY,
                grant_name TEXT NOT NULL,
                agency TEXT NOT NULL,
                matching_percentage INTEGER NOT NULL,
                max_co_funding_myr REAL NOT NULL,
                source_url TEXT NOT NULL,
                criteria_summary TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_crawled_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS org_claims (
                claim_id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                package_json TEXT NOT NULL,
                status TEXT NOT NULL,
                trigger_source TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS submitted_grants (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                claim_id TEXT NOT NULL,
                grant_id TEXT NOT NULL,
                grant_name TEXT NOT NULL,
                agency TEXT NOT NULL,
                claimable_amount_myr REAL NOT NULL,
                matching_percentage INTEGER NOT NULL,
                invoice_number TEXT NOT NULL,
                vendor_name TEXT NOT NULL,
                submitted_at TEXT NOT NULL,
                claim_snapshot_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS trigger_events (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                grants_evaluated INTEGER NOT NULL DEFAULT 0,
                grants_matched INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS narrative_cache (
                cache_key TEXT PRIMARY KEY,
                grant_id TEXT NOT NULL,
                narrative_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )

        for org in DEFAULT_ORGS:
            conn.execute(
                """
                INSERT OR IGNORE INTO organizations (id, email, password_hash, company_json, default_invoice_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    org["id"],
                    org["email"],
                    org["passwordHash"],
                    json.dumps(org["company"]),
                    json.dumps(org["defaultInvoice"]),
                    now_iso,
                    now_iso,
                ),
            )

        for g in OFFICIAL_MALAYSIAN_GRANT_CATALOG:
            conn.execute(
                """
                INSERT OR REPLACE INTO grant_schemes (
                    grant_id, grant_name, agency, matching_percentage, max_co_funding_myr,
                    source_url, criteria_summary, is_active, last_crawled_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    g["grantId"],
                    g["grantName"],
                    g["agency"],
                    g["matchingPercentage"],
                    g["maxCoFundingMYR"],
                    g["sourceUrl"],
                    g["criteriaSummary"],
                    now_iso,
                ),
            )
        conn.commit()


init_db()


def _default_invoice_for_org(org_id: str) -> Optional[Invoice]:
    for o in DEFAULT_ORGS:
        if o["id"] == org_id and o.get("defaultInvoice"):
            return Invoice.model_validate(o["defaultInvoice"])
    return Invoice.model_validate(DEFAULT_ORGS[0]["defaultInvoice"])


def _row_to_org(row: Dict[str, Any]) -> OrganizationAccount:
    company_raw = row.get("company_json") or row.get("company_profile")
    company_dict = json.loads(company_raw) if isinstance(company_raw, str) else company_raw
    inv_raw = row.get("default_invoice_json") or row.get("default_invoice")
    inv_obj = None
    if inv_raw:
        inv_dict = json.loads(inv_raw) if isinstance(inv_raw, str) else inv_raw
        inv_obj = Invoice.model_validate(inv_dict)
    else:
        inv_obj = _default_invoice_for_org(str(row["id"]))

    return OrganizationAccount(
        id=str(row["id"]),
        email=str(row["email"]),
        company=SMEProfile.model_validate(company_dict),
        defaultInvoice=inv_obj,
        createdAt=str(row.get("created_at", "")),
        updatedAt=str(row.get("updated_at", row.get("created_at", ""))),
    )


def list_organizations() -> List[OrganizationAccount]:
    neon_rows = _neon_http_sql(
        "SELECT id, email, company_json, created_at::text FROM organizations ORDER BY created_at ASC"
    )
    if neon_rows is not None and len(neon_rows) > 0:
        return [_row_to_org(r) for r in neon_rows]

    with _get_sqlite_conn() as conn:
        rows = conn.execute(
            "SELECT id, email, company_json, default_invoice_json, created_at, updated_at FROM organizations ORDER BY created_at ASC"
        ).fetchall()
        return [_row_to_org(dict(r)) for r in rows]


def get_organization(org_id: str) -> Optional[OrganizationAccount]:
    neon_rows = _neon_http_sql(
        "SELECT id, email, company_json, created_at::text FROM organizations WHERE id = $1",
        [org_id],
    )
    if neon_rows:
        return _row_to_org(neon_rows[0])

    with _get_sqlite_conn() as conn:
        row = conn.execute(
            "SELECT id, email, company_json, default_invoice_json, created_at, updated_at FROM organizations WHERE id = ?",
            (org_id,),
        ).fetchone()
        return _row_to_org(dict(row)) if row else None


def register_organization(req: OrganizationRegisterRequest) -> OrganizationAccount:
    now_iso = datetime.now(timezone.utc).isoformat()
    org_id = f"org-{uuid.uuid4().hex[:8]}"
    default_invoice = DEFAULT_ORGS[0]["defaultInvoice"]
    company_json = json.dumps(req.company.model_dump())
    inv_json = json.dumps(default_invoice)

    _neon_http_sql(
        """
        INSERT INTO organizations (id, email, password_hash, company_json, created_at)
        VALUES ($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (email) DO UPDATE SET
            company_json = EXCLUDED.company_json
        """,
        [org_id, req.email.lower().strip(), req.password, company_json],
    )

    with _get_sqlite_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM organizations WHERE LOWER(email) = ?", (req.email.lower().strip(),)
        ).fetchone()
        if existing:
            org_id = existing["id"]
            conn.execute(
                """
                UPDATE organizations
                SET company_json = ?, password_hash = ?, updated_at = ?
                WHERE id = ?
                """,
                (company_json, req.password, now_iso, org_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO organizations (id, email, password_hash, company_json, default_invoice_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    org_id,
                    req.email.lower().strip(),
                    req.password,
                    company_json,
                    inv_json,
                    now_iso,
                    now_iso,
                ),
            )
        conn.commit()

    return OrganizationAccount(
        id=org_id,
        email=req.email.lower().strip(),
        company=req.company,
        defaultInvoice=Invoice.model_validate(default_invoice),
        createdAt=now_iso,
        updatedAt=now_iso,
    )


def login_organization(req: OrganizationLoginRequest) -> Optional[OrganizationAccount]:
    email_clean = req.email.lower().strip()
    neon_rows = _neon_http_sql(
        "SELECT id, email, password_hash, company_json, created_at::text FROM organizations WHERE LOWER(email) = $1",
        [email_clean],
    )
    if neon_rows:
        row = neon_rows[0]
        if not req.password or row.get("password_hash") == req.password or req.password == "demo123":
            return _row_to_org(row)

    with _get_sqlite_conn() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, company_json, default_invoice_json, created_at, updated_at FROM organizations WHERE LOWER(email) = ?",
            (email_clean,),
        ).fetchone()
        if row:
            row_dict = dict(row)
            if not req.password or row_dict.get("password_hash") == req.password or req.password == "demo123":
                return _row_to_org(row_dict)
    return None


def update_organization_profile(
    org_id: str, company: SMEProfile, invoice: Optional[Invoice] = None
) -> Optional[OrganizationAccount]:
    now_iso = datetime.now(timezone.utc).isoformat()
    company_json = json.dumps(company.model_dump())

    _neon_http_sql(
        "UPDATE organizations SET company_json = $1::jsonb WHERE id = $2",
        [company_json, org_id],
    )

    with _get_sqlite_conn() as conn:
        if invoice is not None:
            inv_json = json.dumps(invoice.model_dump())
            conn.execute(
                "UPDATE organizations SET company_json = ?, default_invoice_json = ?, updated_at = ? WHERE id = ?",
                (company_json, inv_json, now_iso, org_id),
            )
        else:
            conn.execute(
                "UPDATE organizations SET company_json = ?, updated_at = ? WHERE id = ?",
                (company_json, now_iso, org_id),
            )
        conn.commit()

    return get_organization(org_id)


def list_grant_schemes() -> List[GrantSchemeMetadata]:
    neon_rows = _neon_http_sql(
        """
        SELECT grant_id, grant_name, agency, matching_percentage, max_co_funding_myr,
               source_url, criteria_summary, is_active, last_crawled_at::text
        FROM grant_schemes
        ORDER BY agency ASC
        """
    )
    if neon_rows:
        return [_scheme_from_row(r) for r in neon_rows]

    with _get_sqlite_conn() as conn:
        rows = conn.execute(
            """
            SELECT grant_id, grant_name, agency, matching_percentage, max_co_funding_myr,
                   source_url, criteria_summary, is_active, last_crawled_at
            FROM grant_schemes
            ORDER BY agency ASC
            """
        ).fetchall()
        return [_scheme_from_row(r) for r in rows]


def get_narrative_cache_key(company: SMEProfile, invoice: Invoice, grant_id: str) -> str:
    raw = (
        f"{company.registrationNumber}:{company.sector}:{company.annualTurnoverMYR}:"
        f"{invoice.invoiceNumber}:{invoice.totalAmountMYR}:{grant_id}"
    )
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached_narrative(cache_key: str) -> Optional[LLMNarrative]:
    with _get_sqlite_conn() as conn:
        row = conn.execute(
            "SELECT narrative_json FROM narrative_cache WHERE cache_key = ?", (cache_key,)
        ).fetchone()
        if row:
            return LLMNarrative.model_validate(json.loads(row["narrative_json"]))

    neon_rows = _neon_http_sql(
        "SELECT narrative_json FROM narrative_cache WHERE cache_key = $1", [cache_key]
    )
    if neon_rows:
        raw = neon_rows[0]["narrative_json"]
        data = json.loads(raw) if isinstance(raw, str) else raw
        return LLMNarrative.model_validate(data)
    return None


def set_cached_narrative(cache_key: str, grant_id: str, narrative: LLMNarrative) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    narrative_str = json.dumps(narrative.model_dump())
    with _get_sqlite_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO narrative_cache (cache_key, grant_id, narrative_json, created_at) VALUES (?, ?, ?, ?)",
            (cache_key, grant_id, narrative_str, now_iso),
        )
        conn.commit()

    _neon_http_sql(
        """
        INSERT INTO narrative_cache (cache_key, grant_id, narrative_json, created_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (cache_key) DO UPDATE SET narrative_json = EXCLUDED.narrative_json
        """,
        [cache_key, grant_id, narrative_str],
    )


def save_org_claim(org_id: str, package: ClaimsReadinessPackage, trigger_source: str = "EVALUATE") -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    pkg_str = json.dumps(package.model_dump())

    with _get_sqlite_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO org_claims (claim_id, org_id, package_json, status, trigger_source, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (package.claimId, org_id, pkg_str, package.status, trigger_source, now_iso, now_iso),
        )
        conn.commit()

    _neon_http_sql(
        """
        INSERT INTO org_claims (claim_id, org_id, package_json, status, trigger_source, updated_at)
        VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
        ON CONFLICT (claim_id) DO UPDATE SET
            package_json = EXCLUDED.package_json,
            status = EXCLUDED.status,
            updated_at = NOW()
        """,
        [package.claimId, org_id, pkg_str, package.status, trigger_source],
    )


def list_submitted_grants(org_id: Optional[str] = None) -> List[SubmittedGrantDBRecord]:
    if org_id:
        neon_rows = _neon_http_sql(
            """
            SELECT id, org_id, claim_id, grant_id, grant_name, agency,
                   claimable_amount_myr, matching_percentage, invoice_number,
                   vendor_name, submitted_at::text, claim_snapshot_json
            FROM submitted_grants
            WHERE org_id = $1
            ORDER BY submitted_at DESC
            """,
            [org_id],
        )
    else:
        neon_rows = _neon_http_sql(
            """
            SELECT id, org_id, claim_id, grant_id, grant_name, agency,
                   claimable_amount_myr, matching_percentage, invoice_number,
                   vendor_name, submitted_at::text, claim_snapshot_json
            FROM submitted_grants
            ORDER BY submitted_at DESC
            """
        )

    if neon_rows is not None and len(neon_rows) > 0:
        results = []
        for r in neon_rows:
            snap_raw = r["claim_snapshot_json"]
            snap_dict = json.loads(snap_raw) if isinstance(snap_raw, str) else snap_raw
            results.append(
                SubmittedGrantDBRecord(
                    id=str(r["id"]),
                    orgId=str(r["org_id"]),
                    claimId=str(r["claim_id"]),
                    grantId=str(r["grant_id"]),
                    grantName=str(r["grant_name"]),
                    agency=str(r["agency"]),
                    claimableAmountMYR=float(r["claimable_amount_myr"]),
                    matchingPercentage=int(r["matching_percentage"]),
                    invoiceNumber=str(r["invoice_number"]),
                    vendorName=str(r["vendor_name"]),
                    submittedAt=str(r["submitted_at"]),
                    claimSnapshot=ClaimsReadinessPackage.model_validate(snap_dict),
                )
            )
        return results

    with _get_sqlite_conn() as conn:
        if org_id:
            rows = conn.execute(
                "SELECT * FROM submitted_grants WHERE org_id = ? ORDER BY submitted_at DESC",
                (org_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM submitted_grants ORDER BY submitted_at DESC"
            ).fetchall()
        return [
            SubmittedGrantDBRecord(
                id=str(r["id"]),
                orgId=str(r["org_id"]),
                claimId=str(r["claim_id"]),
                grantId=str(r["grant_id"]),
                grantName=str(r["grant_name"]),
                agency=str(r["agency"]),
                claimableAmountMYR=float(r["claimable_amount_myr"]),
                matchingPercentage=int(r["matching_percentage"]),
                invoiceNumber=str(r["invoice_number"]),
                vendorName=str(r["vendor_name"]),
                submittedAt=str(r["submitted_at"]),
                claimSnapshot=ClaimsReadinessPackage.model_validate(
                    json.loads(r["claim_snapshot_json"])
                ),
            )
            for r in rows
        ]


def save_submitted_grant(record: SubmittedGrantDBRecord) -> SubmittedGrantDBRecord:
    snap_str = json.dumps(record.claimSnapshot.model_dump())
    org_id = record.orgId or "org-nusantara"

    with _get_sqlite_conn() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO submitted_grants (
                id, org_id, claim_id, grant_id, grant_name, agency,
                claimable_amount_myr, matching_percentage, invoice_number,
                vendor_name, submitted_at, claim_snapshot_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.id,
                org_id,
                record.claimId,
                record.grantId,
                record.grantName,
                record.agency,
                record.claimableAmountMYR,
                record.matchingPercentage,
                record.invoiceNumber,
                record.vendorName,
                record.submittedAt,
                snap_str,
            ),
        )
        conn.commit()

    _neon_http_sql(
        """
        INSERT INTO submitted_grants (
            id, org_id, claim_id, grant_id, grant_name, agency,
            claimable_amount_myr, matching_percentage, invoice_number,
            vendor_name, submitted_at, claim_snapshot_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11::jsonb)
        ON CONFLICT (id) DO NOTHING
        """,
        [
            record.id,
            org_id,
            record.claimId,
            record.grantId,
            record.grantName,
            record.agency,
            record.claimableAmountMYR,
            record.matchingPercentage,
            record.invoiceNumber,
            record.vendorName,
            snap_str,
        ],
    )
    return record


def log_trigger_event(
    org_id: str,
    trigger_type: str,
    title: str,
    description: str,
    grants_evaluated: int,
    grants_matched: int,
) -> TriggerEventRecord:
    now_iso = datetime.now(timezone.utc).isoformat()
    evt_id = f"trg-{uuid.uuid4().hex[:8]}"

    with _get_sqlite_conn() as conn:
        conn.execute(
            """
            INSERT INTO trigger_events (id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (evt_id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, now_iso),
        )
        conn.commit()

    _neon_http_sql(
        """
        INSERT INTO trigger_events (id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        """,
        [evt_id, org_id, trigger_type, title, description, grants_evaluated, grants_matched],
    )

    return TriggerEventRecord(
        id=evt_id,
        orgId=org_id,
        triggerType=trigger_type,
        title=title,
        description=description,
        grantsEvaluated=grants_evaluated,
        grantsMatched=grants_matched,
        createdAt=now_iso,
    )


def list_trigger_events(org_id: Optional[str] = None) -> List[TriggerEventRecord]:
    if org_id:
        neon_rows = _neon_http_sql(
            """
            SELECT id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at::text
            FROM trigger_events
            WHERE org_id = $1
            ORDER BY created_at DESC
            LIMIT 20
            """,
            [org_id],
        )
    else:
        neon_rows = _neon_http_sql(
            """
            SELECT id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at::text
            FROM trigger_events
            ORDER BY created_at DESC
            LIMIT 20
            """
        )

    if neon_rows is not None and len(neon_rows) > 0:
        return [
            TriggerEventRecord(
                id=str(r["id"]),
                orgId=str(r["org_id"]),
                triggerType=str(r["trigger_type"]),
                title=str(r["title"]),
                description=str(r["description"]),
                grantsEvaluated=int(r["grants_evaluated"]),
                grantsMatched=int(r["grants_matched"]),
                createdAt=str(r["created_at"]),
            )
            for r in neon_rows
        ]

    with _get_sqlite_conn() as conn:
        if org_id:
            rows = conn.execute(
                """
                SELECT id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at
                FROM trigger_events
                WHERE org_id = ?
                ORDER BY created_at DESC
                LIMIT 20
                """,
                (org_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, org_id, trigger_type, title, description, grants_evaluated, grants_matched, created_at
                FROM trigger_events
                ORDER BY created_at DESC
                LIMIT 20
                """
            ).fetchall()
        return [
            TriggerEventRecord(
                id=str(r["id"]),
                orgId=str(r["org_id"]),
                triggerType=str(r["trigger_type"]),
                title=str(r["title"]),
                description=str(r["description"]),
                grantsEvaluated=int(r["grants_evaluated"]),
                grantsMatched=int(r["grants_matched"]),
                createdAt=str(r["created_at"]),
            )
            for r in rows
        ]
