FROM node:20-alpine

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala apenas dependências de produção para otimizar o tamanho da imagem
RUN npm ci --only=production

# Copia o código fonte
COPY . .

# Expõe a porta do Express middleware
EXPOSE 3001

# Executa o servidor Express
CMD ["node", "src/server.js"]
