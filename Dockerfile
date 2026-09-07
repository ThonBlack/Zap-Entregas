FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# NEXT_PUBLIC_* é embutido no bundle NO BUILD — precisa chegar como build-arg
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

# Build Next.js app
RUN npm run build

# Set database path (consistent with docker-compose volume)
ENV DATABASE_PATH=/app/sqlite.db

# Expose port (internal container port)
EXPOSE 3000

# Migrações leves rodam antes do servidor: deploy novo ou restore de backup
# antigo nunca sobe sem as colunas que o código espera.
CMD ["sh", "-c", "node scripts/utils/add_transaction_kind_column.js && node scripts/utils/make_phone_nullable.js && node scripts/utils/add_invite_token_columns.js && node scripts/utils/add_shopkeeper_id_column.js && node scripts/utils/add_external_id_column.js && node scripts/utils/add_daily_closings_table.js && npm start"]
