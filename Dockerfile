FROM node:18-alpine

WORKDIR /app

# Install dependencies (only production if possible, but build needs devDeps)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Prune dev dependencies for lighter image
RUN npm prune --production

# Expose port (internal container port)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
