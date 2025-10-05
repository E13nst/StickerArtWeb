# Multi-stage build for React app with Nginx

# Stage 1: Build React app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Set build environment
ENV NODE_ENV=production
ENV VITE_BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

# Build app
RUN npm run build

# Stage 2: Nginx for static files
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Set default environment
ENV BACKEND_URL=https://stickerartgallery-e13nst.amvera.io

EXPOSE 80

# Start nginx with environment substitution
CMD envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'

