# Frontend Dockerfile for Finnish Statistics Platform
#
# This Dockerfile builds the React/Vite frontend.
# It uses a multi-stage build for production optimization.
#
# Usage:
#   docker build -t geoinfo-frontend ./frontend
#   docker run -p 5173:5173 geoinfo-frontend
#
# For development with hot-reload, use docker-compose which mounts the source.

# =============================================================================
# Development Stage
# =============================================================================
FROM node:20-alpine AS development

WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Development command with hot-reload
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# =============================================================================
# Build Stage
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build for production
RUN npm run build

# =============================================================================
# Production Stage (optional, for static file serving)
# =============================================================================
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config if needed
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
