FROM node:18-alpine

WORKDIR /app

# Install system dependencies for OCR
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    ttf-freefont

# Copy package files
COPY package*.json ./
COPY ../../packages/shared/package.json ../packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .
COPY ../../packages/shared ../packages/shared

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S ocruser -u 1001

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R ocruser:nodejs /app

USER ocruser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).end()"

EXPOSE 3002

CMD ["npm", "start"]