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

# Start command (using npm start which runs 'next start')
CMD ["npm", "start"]
