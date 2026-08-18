FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
COPY lib ./lib

ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787

CMD ["node", "server/gemini-gateway.js"]
