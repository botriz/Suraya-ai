FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js ./
COPY ai ./ai
COPY health ./health
COPY routes ./routes
COPY world ./world
COPY migrations ./migrations
COPY public ./public

RUN chown -R node:node /app
USER node
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
