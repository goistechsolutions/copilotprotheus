import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath("backend"))
load_dotenv(".env")

os.chdir("backend")
os.system(r"venv\Scripts\alembic upgrade head")
