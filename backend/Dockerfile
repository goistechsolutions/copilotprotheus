# Stage 1: Build Admin Frontend
FROM node:20-slim AS admin-builder
WORKDIR /app
COPY admin-frontend/package*.json ./
RUN npm ci || npm install
COPY admin-frontend/ ./
RUN npm run build

# Stage 2: Python Backend FastAPI
FROM python:3.12-slim

WORKDIR /app

# Copia e instala as dependências
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código do backend
COPY backend/ .

# Copia o bundle compilado do admin-frontend para static/admin
COPY --from=admin-builder /app/dist ./static/admin

# Expõe a porta do FastAPI
EXPOSE 8000

# Executa o servidor uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
