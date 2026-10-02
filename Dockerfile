# Multi-stage production container for Azure App Service & Azure Container Apps
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json .npmrc ./
RUN npm install

# Copy source files
COPY . .

# Run linting and build SPA bundles
RUN npm run lint
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json .npmrc ./
RUN npm install --omit=dev

# Copy compiled frontend and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/public ./public

# Non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
