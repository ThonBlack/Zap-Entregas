FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/sqlite.db ./sqlite.db

# Rebuild sqlite for alpine runner environment if needed
RUN apk add --no-cache python3 make g++ && npm rebuild better-sqlite3 && apk del python3 make g++

EXPOSE 3000

CMD ["node", "server.js"]
