cd /root/copilotprotheus && git pull origin main && docker compose up -d --build backend && docker compose logs -n 100 -f backend
