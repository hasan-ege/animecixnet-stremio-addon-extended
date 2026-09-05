FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Bağımlılık katmanını önbelleğe almak için önce package dosyaları kopyalanır
COPY package*.json ./

RUN npm ci --only=production

# Proje dosyalarını kopyala (.dockerignore gereksiz dosyaları filtreler)
COPY . .

# Altyazı dizininin var olduğundan emin ol
RUN mkdir -p static/subs

EXPOSE 7000

# 512MB RAM sınırında OOM (Out-of-Memory) çökmesini önlemek için V8 heap limiti
CMD ["node", "--max-old-space-size=384", "index.js"]
