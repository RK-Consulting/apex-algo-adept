# backend/Dockerfile
##############################################
# 🏗 STAGE 1 — Build Stage (TypeScript → JS)
##############################################
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first for cache efficiency
COPY package*.json ./
RUN npm install

# Copy full source
COPY . .

# Build TypeScript
RUN npm run build


##############################################
# 🚀 STAGE 2 — Production Runtime
##############################################
FROM node:18-alpine

WORKDIR /app

# Copy only what is needed for production
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy environment file (optional — or mount at runtime)
# COPY .env .env

# Expose backend API port
EXPOSE 8080

# Run production server
CMD ["node", "dist/server.js"]
