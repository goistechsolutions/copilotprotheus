import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the root directory to path to import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db.database import Base
# Import the models to register them
from app.models.knowledge import Document, DocumentChunk, Memory, AuditLog

DATABASE_URL = os.getenv('DATABASE_URL', '')

def init_db():
    print("Connecting to database:", DATABASE_URL)
    engine = create_engine(DATABASE_URL)
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables with new schema...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    init_db()
