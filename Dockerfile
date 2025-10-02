# Build stage for Evolution API
FROM node:24-alpine AS api-builder

# Install system dependencies and tools
RUN apk update && \
    apk add --no-cache git ffmpeg wget curl bash openssl

# Container metadata
LABEL version="2.3.1" description="Api to control whatsapp features through http requests." 
LABEL maintainer="Davidson Gomes" git="https://github.com/DavidsonGomes"
LABEL contact="contato@evolution-api.com"

# Set working directory
WORKDIR /evolution

# Copy package files for dependency installation
COPY ./package*.json ./
COPY ./tsconfig.json ./
COPY ./tsup.config.ts ./

# Install Node.js dependencies
RUN npm ci --silent

# Copy source code and configuration files
COPY ./src ./src
COPY ./public ./public
COPY ./prisma ./prisma
COPY ./.env.example ./.env
COPY ./runWithProvider.js ./

# Copy Docker scripts
COPY ./Docker ./Docker

# Set executable permissions for scripts
RUN chmod +x ./Docker/scripts/* && dos2unix ./Docker/scripts/*

# Generate database schema
RUN ./Docker/scripts/generate_database.sh

# Build the application
RUN npm run build

# Build stage for Manager UI
FROM node:24-alpine AS manager-builder

# Set working directory for manager
WORKDIR /manager

# Copy manager package files
COPY ./manager/package*.json ./

# Install manager dependencies
RUN npm ci --silent

# Copy manager source code
COPY ./manager ./

# Build manager application
RUN npm run build

# Production stage
FROM node:24-alpine AS final

# Install runtime dependencies
RUN apk update && \
    apk add tzdata ffmpeg bash openssl

# Set timezone and environment variables
ENV TZ=America/Sao_Paulo
ENV DOCKER_ENV=true

# Set working directory
WORKDIR /evolution

# Copy package files from api-builder stage
COPY --from=api-builder /evolution/package.json ./package.json
COPY --from=api-builder /evolution/package-lock.json ./package-lock.json

# Copy built application and dependencies
COPY --from=api-builder /evolution/node_modules ./node_modules
COPY --from=api-builder /evolution/dist ./dist
COPY --from=api-builder /evolution/prisma ./prisma
COPY --from=manager-builder /manager/dist ./manager/dist
COPY --from=api-builder /evolution/public ./public
COPY --from=api-builder /evolution/.env ./.env
COPY --from=api-builder /evolution/Docker ./Docker
COPY --from=api-builder /evolution/runWithProvider.js ./runWithProvider.js
COPY --from=api-builder /evolution/tsup.config.ts ./tsup.config.ts

# Expose application port
EXPOSE 8080

# Start the application
ENTRYPOINT ["/bin/bash", "-c", ". ./Docker/scripts/deploy_database.sh && npm run start:prod" ]
