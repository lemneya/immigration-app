# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy shared packages
COPY packages/ ./packages/

# Copy app source
COPY apps/client-portal/ ./apps/client-portal/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/apps/client-portal
RUN pnpm build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/client-portal/.next ./
COPY --from=builder /app/apps/client-portal/public ./public
COPY --from=builder /app/apps/client-portal/package.json ./
COPY --from=builder /app/apps/client-portal/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3013

EXPOSE 3013

CMD ["npm", "start"]