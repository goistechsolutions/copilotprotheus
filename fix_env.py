import os
import re

with open(".env", "r", encoding="utf-8") as f:
    env_content = f.read()

# Fix DB password
env_content = env_content.replace("postgres:postgres@localhost:5435", "postgres:senha_local@localhost:5435")
env_content = re.sub(r'POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=senha_local', env_content)

# Fix JWT_SECRET length
env_content = re.sub(r'JWT_SECRET=.*', 'JWT_SECRET=super_secret_key_local_123_min_32_chars_123', env_content)
env_content = re.sub(r'SECRET_KEY=.*', 'SECRET_KEY=super_secret_key_local_123_min_32_chars_123', env_content)

with open(".env", "w", encoding="utf-8") as f:
    f.write(env_content)
