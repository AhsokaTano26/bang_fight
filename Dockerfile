# ---- Stage 1: Build frontend ----
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Build backend ----
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# ---- Stage 3: Production ----
FROM node:20-alpine
WORKDIR /app

# Install production dependencies only
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=backend-builder /app/backend/dist ./dist/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist/

EXPOSE 3000

CMD ["node", "dist/main"]
