import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load env from root
load_dotenv(dotenv_path=".env")

if __name__ == "__main__":
    # Change CWD to backend so static files are found correctly
    os.chdir(os.path.join(os.path.dirname(__file__), "backend"))
    sys.path.insert(0, os.getcwd())
    
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
