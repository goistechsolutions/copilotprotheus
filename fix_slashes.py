with open("backend/alembic/versions/v4_full_create.py", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace(r"\'", "'")
with open("backend/alembic/versions/v4_full_create.py", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
