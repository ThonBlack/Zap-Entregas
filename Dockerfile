FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Set database path (consistent with docker-compose volume)
ENV DATABASE_PATH=/app/sqlite.db

# Expose port (internal container port)
EXPOSE 3000

# Start command (using npm start which runs 'next start')
CMD ["npm", "start"]
