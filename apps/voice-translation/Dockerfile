FROM node:18-alpine

WORKDIR /app

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    curl \
    ca-certificates

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3009/health || exit 1

# Expose port
EXPOSE 3009

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3009

# Start the application
CMD ["npm", "start"]