from fastapi import FastAPI
from fastapi.responses import RedirectResponse, FileResponse
from starlette.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
import os

app = FastAPI()

class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise ex

os.makedirs("test_static/admin", exist_ok=True)
with open("test_static/admin/index.html", "w") as f:
    f.write("<html><body>test</body></html>")

@app.get("/admin")
def serve_admin_no_slash():
    return FileResponse("test_static/admin/index.html")

app.mount("/admin/", SPAStaticFiles(directory="test_static/admin", html=True), name="admin")
