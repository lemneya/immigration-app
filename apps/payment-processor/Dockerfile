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
COPY apps/payment-processor/ ./apps/payment-processor/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the application
WORKDIR /app/apps/payment-processor
RUN pnpm build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy built application
COPY --from=builder /app/apps/payment-processor/dist ./dist
COPY --from=builder /app/apps/payment-processor/package.json ./
COPY --from=builder /app/apps/payment-processor/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production
ENV PORT=3014

EXPOSE 3014

CMD ["node", "dist/index.js"]