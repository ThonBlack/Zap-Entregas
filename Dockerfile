FROM node:20

WORKDIR /app

# Create data directory for persistent storage
RUN mkdir -p /data

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Set database path to /data for persistence
ENV DATABASE_PATH=/data/sqlite.db

# Expose port (internal container port)
EXPOSE 3000

# Start command (using npm start which runs 'next start')
CMD ["npm", "start"]
