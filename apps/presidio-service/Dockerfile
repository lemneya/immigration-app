FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY apps/presidio-service/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY apps/presidio-service/src ./src

# Expose port
EXPOSE 3024

# Start the service
CMD ["node", "src/index.js"]