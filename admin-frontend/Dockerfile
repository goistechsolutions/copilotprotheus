# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Configuracao do Nginx para suportar React Router (SPA) e proxy /api com cookies
RUN printf 'server {
    listen 80;

    # Serve o bundle React (SPA)
    location /admin/ {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location = / {
        return 301 /admin/;
    }

    # Proxy para o backend FastAPI - repassa cookies e headers de autenticacao
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Essencial: repassa cookies do browser para o backend
        proxy_set_header Cookie $http_cookie;

        # Essencial: devolve o Set-Cookie do backend para o browser (logout expira cookie)
        proxy_pass_header Set-Cookie;

        # Garante que o path do cookie seja / e nao /api
        proxy_cookie_path /api /;
    }
}
' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
