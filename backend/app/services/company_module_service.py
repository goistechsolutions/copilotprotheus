import uuid
import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.schemas.company_modules import CompanyModulesSaveRequest


def get_company_or_404(db: Session, company_id: int):
    row = db.execute(
        text("""
            SELECT
                id,
                tenant_id,
                company_code AS code,
                COALESCE(company_name, razao_social, 'Empresa ' || id) AS name,
                status,
                protheus_rest_url,
                protheus_usuario,
                encrypted_protheus_password,
                protheus_ambientes
            FROM companies
            WHERE id = :company_id
        """),
        {"company_id": company_id}
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    return dict(row)


def list_companies(db: Session, tenant_id: str | None = None):
    sql = """
        SELECT
            id,
            tenant_id,
            company_code AS code,
            COALESCE(company_name, razao_social, 'Empresa ' || id) AS name,
            status,
            created_at
        FROM companies
        WHERE 1=1
    """
    params = {}

    if tenant_id:
        sql += " AND tenant_id = :tenant_id"
        params["tenant_id"] = tenant_id

    sql += " ORDER BY COALESCE(company_name, razao_social, 'Empresa ' || id)"

    rows = db.execute(text(sql), params).mappings().all()
    return [dict(r) for r in rows]


def list_company_modules(db: Session, company_id: int, tenant_id: str):
    rows = db.execute(
        text("""
            SELECT
                :company_id AS company_id,
                tmc.tenant_id,
                pmm.module_code,
                COALESCE(pmm.module_name, pmm.module_code) AS module_name,
                (CASE WHEN tmc.status = 'allowed' THEN TRUE ELSE FALSE END) AS enabled,
                tmc.created_at
            FROM tenant_module_contracts tmc
            INNER JOIN protheus_modules_master pmm
              ON pmm.id = tmc.module_id
            WHERE tmc.tenant_id = :tenant_id
              AND tmc.status = 'allowed'
            ORDER BY pmm.module_code
        """),
        {"company_id": company_id, "tenant_id": tenant_id}
    ).mappings().all()

    return [dict(r) for r in rows]


def _get_or_create_active_contract(db: Session, tenant_id: str) -> str:
    contract_row = db.execute(
        text("SELECT id FROM tenant_contracts WHERE tenant_id = :tenant_id AND contract_status = 'active' LIMIT 1"),
        {"tenant_id": tenant_id}
    ).mappings().first()
    if not contract_row:
        contract_row = db.execute(
            text("SELECT id FROM tenant_contracts WHERE tenant_id = :tenant_id LIMIT 1"),
            {"tenant_id": tenant_id}
        ).mappings().first()

    if not contract_row:
        new_contract_id = str(uuid.uuid4())
        contract_code = f"CONTRACT-{tenant_id[:30]}-{int(datetime.datetime.now().timestamp())}"
        db.execute(
            text("""
                INSERT INTO tenant_contracts (id, tenant_id, contract_code, contract_status, starts_at, created_at, updated_at)
                VALUES (:cid, :tid, :ccode, 'active', CURRENT_DATE, NOW(), NOW())
            """),
            {"cid": new_contract_id, "tid": tenant_id, "ccode": contract_code}
        )
        return new_contract_id
    return str(contract_row["id"])


def replace_company_modules(
    db: Session,
    company_id: int,
    tenant_id: str,
    payload: CompanyModulesSaveRequest,
):
    try:
        contract_id = _get_or_create_active_contract(db, tenant_id)

        db.execute(
            text("""
                DELETE FROM tenant_module_contracts
                WHERE tenant_id = :tenant_id
                  AND contract_id = :contract_id
            """),
            {"tenant_id": tenant_id, "contract_id": contract_id}
        )

        for item in payload.modules:
            if not item.enabled:
                continue
            mod_code = item.module_code.strip().upper()

            master_row = db.execute(
                text("SELECT id FROM protheus_modules_master WHERE module_code = :code LIMIT 1"),
                {"code": mod_code}
            ).mappings().first()

            if not master_row:
                mod_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO protheus_modules_master (id, module_code, module_name, source_name, active, created_at)
                        VALUES (:id, :code, :name, 'SYS_USR_MODULE', TRUE, NOW())
                    """),
                    {"id": mod_id, "code": mod_code, "name": mod_code}
                )
            else:
                mod_id = str(master_row["id"])

            db.execute(
                text("""
                    INSERT INTO tenant_module_contracts
                        (id, tenant_id, contract_id, module_id, status, created_at)
                    VALUES
                        (:id, :tenant_id, :contract_id, :module_id, 'allowed', NOW())
                """),
                {
                    "id": str(uuid.uuid4()),
                    "tenant_id": tenant_id,
                    "contract_id": contract_id,
                    "module_id": mod_id,
                }
            )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao salvar módulos da empresa: {str(e)}"
        )

    return len([m for m in payload.modules if m.enabled])


def get_enabled_modules(db: Session, company_id: int, tenant_id: str) -> list[str]:
    rows = db.execute(
        text("""
            SELECT pmm.module_code
            FROM tenant_module_contracts tmc
            INNER JOIN protheus_modules_master pmm ON pmm.id = tmc.module_id
            WHERE tmc.tenant_id = :tenant_id
              AND tmc.status = 'allowed'
            ORDER BY pmm.module_code
        """),
        {"tenant_id": tenant_id}
    ).mappings().all()

    return [r["module_code"] for r in rows]


def preload_allowed_tables_from_dictionary(db: Session, company_id: int, tenant_id: str):
    try:
        contract_id = _get_or_create_active_contract(db, tenant_id)

        db.execute(
            text("""
                DELETE FROM tenant_allowed_tables
                WHERE tenant_id = :tenant_id
                  AND contract_id = :contract_id
            """),
            {"tenant_id": tenant_id, "contract_id": contract_id}
        )

        db.execute(
            text("""
                INSERT INTO tenant_allowed_tables
                    (tenant_id, contract_id, snapshot_id, table_id, access_level, allowed, rationale, created_at, updated_at)
                SELECT
                    tdt.tenant_id,
                    :contract_id,
                    tdt.snapshot_id,
                    tdt.id,
                    'query',
                    TRUE,
                    'preload_allowed_tables_from_dictionary',
                    NOW(),
                    NOW()
                FROM dictionary_tables dt
                INNER JOIN protheus_modules_master pmm
                    ON pmm.module_code = dt.module_code
                INNER JOIN tenant_module_contracts tmc
                    ON tmc.tenant_id = dt.tenant_id
                   AND tmc.contract_id = :contract_id
                   AND tmc.module_id = pmm.id
                   AND tmc.status = 'allowed'
                WHERE dt.tenant_id = :tenant_id
            """),
            {"tenant_id": tenant_id, "contract_id": contract_id}
        )
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao pré-carregar tabelas permitidas: {str(e)}"
        )
