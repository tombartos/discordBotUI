# syntax=docker/dockerfile:1

# --- Build stage: compile the Vite/React app ---
FROM node:20-alpine AS build
WORKDIR /app/frontend

# Install deps first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy the rest of the frontend sources and build
COPY frontend/ ./
RUN npm run build


# --- Runtime stage: serve static files with Nginx ---
FROM nginx:1.27-alpine AS runtime

# SPA-friendly Nginx config (fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
