import os

with open(".env", "a", encoding="utf-8") as f:
    f.write("\n# Admin Credentials\n")
    f.write("ADMIN_USER=admin\n")
    f.write("ADMIN_PASSWORD=admin\n")
    f.write("ADMIN_JWT_SECRET=super_secret_admin_key_123_min_32_chars_123\n")
