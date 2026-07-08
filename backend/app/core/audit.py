from sqlalchemy.orm import Session
from sqlalchemy import text

class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def save(self, event: dict):
        try:
            self.db.execute(text("""
            CREATE TABLE IF NOT EXISTS assistant_audit (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT,
                user_name TEXT,
                session_id TEXT,
                question TEXT,
                answer TEXT,
                module TEXT,
                company TEXT,
                branch TEXT,
                environment TEXT,
                station TEXT,
                intent TEXT,
                confidence REAL,
                response_time_ms INTEGER,
                data_volume INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """))
            self.db.execute(text("""
            INSERT INTO assistant_audit
            (tenant_id, user_name, session_id, question, answer, module, company, branch, environment, station,
             intent, confidence, response_time_ms, data_volume)
            VALUES
            (:tenant_id, :user_name, :session_id, :question, :answer, :module, :company, :branch, :environment, :station,
             :intent, :confidence, :response_time_ms, :data_volume)
            """), event)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
