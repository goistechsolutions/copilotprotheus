import os
import sys
import uvicorn
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")

if __name__ == "__main__":
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
