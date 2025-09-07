# Multi-stage build for Format Service with Okapi support
FROM openjdk:11-jdk-slim AS java-base

# Install system dependencies for file processing
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    curl \
    wget \
    unzip \
    libxml2-dev \
    libxslt1-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Download and install Okapi Framework
WORKDIR /opt
RUN wget https://okapiframework.org/binaries/main/1.44.0/okapi-apps_cocoon-m40-x64_1.44.0.zip \
    && unzip okapi-apps_cocoon-m40-x64_1.44.0.zip \
    && rm okapi-apps_cocoon-m40-x64_1.44.0.zip \
    && chmod +x okapi-apps_cocoon-m40-x64_1.44.0/tikal.sh

# Set environment variables for Okapi
ENV OKAPI_ROOT=/opt/okapi-apps_cocoon-m40-x64_1.44.0
ENV PATH="${OKAPI_ROOT}:${PATH}"

FROM python:3.11-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openjdk-11-jre-headless \
    poppler-utils \
    libxml2 \
    libxslt1.1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Okapi from Java base
COPY --from=java-base /opt/okapi-apps_cocoon-m40-x64_1.44.0 /opt/okapi-apps_cocoon-m40-x64_1.44.0

# Set Okapi environment
ENV OKAPI_ROOT=/opt/okapi-apps_cocoon-m40-x64_1.44.0
ENV PATH="${OKAPI_ROOT}:${PATH}"
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64

# Create non-root user
RUN groupadd -r formatservice && useradd -r -g formatservice formatservice

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Create directories for file processing
RUN mkdir -p /app/temp /app/output /app/uploads && \
    chown -R formatservice:formatservice /app

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV TEMP_DIR=/app/temp
ENV OUTPUT_DIR=/app/output
ENV UPLOAD_DIR=/app/uploads

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8001/health', timeout=5)"

# Switch to non-root user
USER formatservice

# Expose port
EXPOSE 8001

# Start the service
CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8001"]