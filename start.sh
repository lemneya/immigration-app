#!/bin/bash

# Immigration Suite - Quick Start Script
# This script starts all services with one command

echo "🚀 Starting Immigration Suite..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Function to start services
start_services() {
    echo -e "${BLUE}Starting option $1...${NC}"
    
    case $1 in
        1)
            echo -e "${GREEN}🐳 Starting all services with Docker...${NC}"
            docker-compose up -d
            echo -e "${GREEN}✅ All services started!${NC}"
            echo ""
            echo "Services available at:"
            echo "  📱 Client Portal: http://localhost:3013"
            echo "  👨‍⚖️ Admin Dashboard: http://localhost:3012"
            echo "  👩‍💼 Paralegal Dashboard: http://localhost:3021"
            echo "  🔒 Security Service: http://localhost:3007"
            echo "  📧 Mail Service: http://localhost:3010"
            echo "  🗣️ Voice Translation: http://localhost:3006"
            ;;
        2)
            echo -e "${GREEN}🔧 Starting development mode (pnpm)...${NC}"
            # Start core services
            cd apps/security && pnpm dev &
            cd ../client-portal && pnpm dev &
            cd ../admin-dashboard && pnpm dev &
            cd ../ocr && pnpm dev &
            cd ../pdf-fill && pnpm dev &
            cd ../mail-service && pnpm dev &
            echo -e "${GREEN}✅ Development servers started!${NC}"
            ;;
        3)
            echo -e "${GREEN}🎯 Starting minimal services...${NC}"
            # Start only essential services
            docker-compose up -d postgres redis mongodb
            cd apps/security && pnpm dev &
            cd ../client-portal && pnpm dev &
            echo -e "${GREEN}✅ Minimal services started!${NC}"
            echo "  📱 Client Portal: http://localhost:3013"
            echo "  🔒 Security Service: http://localhost:3007"
            ;;
        4)
            echo -e "${YELLOW}📊 Checking service status...${NC}"
            docker-compose ps
            echo ""
            echo "Running processes:"
            ps aux | grep -E "(pnpm|node)" | grep -v grep | head -10
            ;;
        5)
            echo -e "${YELLOW}🛑 Stopping all services...${NC}"
            docker-compose down
            pkill -f "pnpm dev"
            echo -e "${GREEN}✅ All services stopped${NC}"
            ;;
        *)
            echo "Invalid option"
            ;;
    esac
}

# Main menu
echo "Choose startup option:"
echo "1) 🐳 Start all services with Docker (recommended)"
echo "2) 🔧 Start in development mode (pnpm)"
echo "3) 🎯 Start minimal services (Security + Client Portal)"
echo "4) 📊 Check service status"
echo "5) 🛑 Stop all services"
echo ""
read -p "Enter option (1-5): " option

start_services $option

# Keep script running if in dev mode
if [ "$option" = "2" ] || [ "$option" = "3" ]; then
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    wait
fi