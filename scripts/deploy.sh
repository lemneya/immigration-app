#!/bin/bash

# Bmore Immigration Suite Deployment Script
# Usage: ./scripts/deploy.sh [environment] [service]
# Example: ./scripts/deploy.sh production all
# Example: ./scripts/deploy.sh staging security

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-development}"
SERVICE="${2:-all}"
BACKUP="${3:-true}"

echo -e "${BLUE}🚀 Bmore Immigration Suite Deployment Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Service: ${SERVICE}${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment. Use: development, staging, or production${NC}"
    exit 1
fi

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${GREEN}✅ Loading environment variables from .env.${ENVIRONMENT}${NC}"
    export $(cat .env.${ENVIRONMENT} | xargs)
elif [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Using default .env file${NC}"
    export $(cat .env | xargs)
else
    echo -e "${YELLOW}⚠️  No environment file found, using defaults${NC}"
fi

# Pre-deployment checks
echo -e "${BLUE}🔍 Running pre-deployment checks...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

# Check for required files
REQUIRED_FILES=("docker-compose.yml" "nginx/nginx.conf" "init-mongo.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done

# Create backup if in production
if [ "$ENVIRONMENT" = "production" ] && [ "$BACKUP" = "true" ]; then
    echo -e "${YELLOW}💾 Creating backup...${NC}"
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB
    if docker-compose ps mongodb | grep -q "Up"; then
        docker-compose exec -T mongodb mongodump --archive="$BACKUP_DIR/mongodb_backup.archive"
        echo -e "${GREEN}✅ MongoDB backup created${NC}"
    fi
    
    # Backup uploaded files
    if [ -d "uploads" ]; then
        tar -czf "$BACKUP_DIR/uploads_backup.tar.gz" uploads/
        echo -e "${GREEN}✅ Files backup created${NC}"
    fi
fi

# Build and deploy
echo -e "${BLUE}🏗️  Building and deploying services...${NC}"

# Determine compose files
COMPOSE_FILES="-f docker-compose.yml"

if [ "$ENVIRONMENT" = "development" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.dev.yml"
elif [ "$ENVIRONMENT" = "staging" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.staging.yml"
fi

# Deploy specific service or all services
if [ "$SERVICE" = "all" ]; then
    echo -e "${BLUE}🚀 Deploying all services...${NC}"
    
    # Pull latest images
    docker-compose $COMPOSE_FILES pull
    
    # Start services
    docker-compose $COMPOSE_FILES up -d --remove-orphans
    
    # Wait for services to be healthy
    echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
    sleep 30
    
else
    echo -e "${BLUE}🚀 Deploying service: $SERVICE${NC}"
    
    # Check if service exists
    if ! docker-compose $COMPOSE_FILES config --services | grep -q "^$SERVICE$"; then
        echo -e "${RED}❌ Service '$SERVICE' not found${NC}"
        exit 1
    fi
    
    # Pull and deploy specific service
    docker-compose $COMPOSE_FILES pull "$SERVICE"
    docker-compose $COMPOSE_FILES up -d --no-deps "$SERVICE"
    
    echo -e "${BLUE}⏳ Waiting for service to be healthy...${NC}"
    sleep 15
fi

# Health checks
echo -e "${BLUE}🏥 Running health checks...${NC}"

HEALTH_ENDPOINTS=(
    "http://localhost:3000/api/health:Web App"
    "http://localhost:3001/api/health:Admin Dashboard" 
    "http://localhost:3010/health:Security Service"
    "http://localhost:8000/health:OCR Service"
    "http://localhost:3002/health:PDF Fill Service"
    "http://localhost:3003/health:E-signature Service"
    "http://localhost:3004/health:Case Status Service"
    "http://localhost:3009/health:Voice Translation Service"
)

FAILED_CHECKS=0

for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
    url=$(echo "$endpoint" | cut -d':' -f1-2)
    name=$(echo "$endpoint" | cut -d':' -f3)
    
    if [ "$SERVICE" != "all" ] && [[ ! "$name" =~ $SERVICE ]]; then
        continue
    fi
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $name is healthy${NC}"
    else
        echo -e "${RED}❌ $name health check failed${NC}"
        ((FAILED_CHECKS++))
    fi
done

# Database health check
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "mongodb" ]; then
    if docker-compose exec -T mongodb mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ MongoDB is healthy${NC}"
    else
        echo -e "${RED}❌ MongoDB health check failed${NC}"
        ((FAILED_CHECKS++))
    fi
fi

# Redis health check
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "redis" ]; then
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis is healthy${NC}"
    else
        echo -e "${RED}❌ Redis health check failed${NC}"
        ((FAILED_CHECKS++))
    fi
fi

# Cleanup
echo -e "${BLUE}🧹 Cleaning up...${NC}"
docker system prune -f > /dev/null 2>&1

# Final status
echo -e "${BLUE}📊 Deployment Summary${NC}"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "Failed health checks: $FAILED_CHECKS"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${GREEN}🌐 Production URLs:${NC}"
        echo "   Web App: https://immigration-suite.gov"
        echo "   Admin: https://admin.immigration-suite.gov" 
        echo "   API: https://api.immigration-suite.gov"
    else
        echo -e "${GREEN}🌐 Local URLs:${NC}"
        echo "   Web App: http://localhost:3000"
        echo "   Admin: http://localhost:3001"
        echo "   Security API: http://localhost:3010"
    fi
    
    exit 0
else
    echo -e "${RED}⚠️  Deployment completed with $FAILED_CHECKS failed health checks${NC}"
    echo -e "${YELLOW}🔍 Check logs: docker-compose logs [service-name]${NC}"
    exit 1
fi