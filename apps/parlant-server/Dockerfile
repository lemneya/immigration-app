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
COPY apps/parlant-server/ ./apps/parlant-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/apps/parlant-server
RUN pnpm build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy built application
COPY --from=builder /app/apps/parlant-server/dist ./dist
COPY --from=builder /app/apps/parlant-server/package.json ./
COPY --from=builder /app/apps/parlant-server/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3012

EXPOSE 3012

CMD ["node", "dist/index.js"]