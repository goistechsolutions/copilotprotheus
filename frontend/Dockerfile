# Estágio de build
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio de produção com Nginx
FROM nginx:alpine
# Copia o build do React para a pasta de HTML do Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Copia configuração do Nginx se necessário (opcional, Nginx padrão já serve HTML)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
