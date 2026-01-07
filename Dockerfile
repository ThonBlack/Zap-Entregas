FROM node:20-slim AS builder
WORKDIR /app
# Install build dependencies (Debian uses apt-get)
RUN apt-get update && apt-get install -y python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner Stage
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/sqlite.db ./sqlite.db

# Rebuild sqlite for runner environment (just in case)
RUN apt-get update && apt-get install -y python3 make g++ && npm rebuild better-sqlite3 && apt-get remove -y python3 make g++ && apt-get autoremove -y

EXPOSE 3000

CMD ["node", "server.js"]
