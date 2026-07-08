# Estágio 1: Build da aplicação React
FROM node:20-alpine AS build

WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm ci

# Compila para produção
COPY . .
RUN npm run build

# Estágio 2: Servidor Nginx para entrega dos arquivos estáticos
FROM nginx:alpine

# Copia a configuração customizada do Nginx para suportar roteamento SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos gerados pelo build para a pasta padrão do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Expõe a porta 80
EXPOSE 80

# Inicia o Nginx
CMD ["nginx", "-g", "daemon off;"]
