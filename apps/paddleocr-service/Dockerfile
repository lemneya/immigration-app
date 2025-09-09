FROM node:18-alpine

# Install Python and PaddleOCR dependencies
RUN apk add --no-cache python3 py3-pip python3-dev build-base jpeg-dev zlib-dev

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Install PaddleOCR (mock for now, in production would install actual PaddleOCR)
# RUN pip3 install paddlepaddle paddleocr

# Copy app source
COPY . .

# Expose port
EXPOSE 3023

# Start the service
CMD ["node", "src/index.js"]