FROM node:22.15-slim

WORKDIR /app

COPY package.json ./
RUN npm install

# Instala PM2 globalmente
RUN npm install -g pm2

COPY . .

EXPOSE 3006

# Usa PM2 para iniciar la app
CMD ["pm2-runtime", "start", "npm", "--", "start"]