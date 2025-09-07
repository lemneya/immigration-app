.PHONY: help install dev build test clean docker-up docker-down docker-logs db-migrate db-studio

# Default target
help: ## Show this help message
	@echo "Immigration Suite - Multilingual Immigration Assistant"
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation and setup
install: ## Install all dependencies
	@echo "Installing dependencies..."
	pnpm install

setup: ## Initial setup (copy env, install deps, start services)
	@echo "Setting up Immigration Suite..."
	cp .env.example .env
	pnpm install
	make docker-up
	@echo "Waiting for services to be ready..."
	sleep 10
	make db-migrate
	@echo "Setup complete! Run 'make dev' to start development."

# Development
dev: ## Start development servers
	@echo "Starting development servers..."
	pnpm dev

build: ## Build all applications
	@echo "Building all applications..."
	pnpm build

test: ## Run tests
	@echo "Running tests..."
	pnpm test

lint: ## Run linting
	@echo "Running linters..."
	pnpm lint

clean: ## Clean all dependencies and build artifacts
	@echo "Cleaning up..."
	pnpm clean
	docker compose -f infra/docker/docker-compose.yml down -v
	docker system prune -f

# Docker services
docker-up: ## Start all Docker services
	@echo "Starting Docker services..."
	docker compose -f infra/docker/docker-compose.yml up -d

docker-down: ## Stop all Docker services
	@echo "Stopping Docker services..."
	docker compose -f infra/docker/docker-compose.yml down

docker-logs: ## View Docker logs
	docker compose -f infra/docker/docker-compose.yml logs -f

docker-restart: ## Restart Docker services
	make docker-down
	make docker-up

# Database
db-migrate: ## Run database migrations
	@echo "Running database migrations..."
	cd infra/db && npx prisma migrate deploy

db-studio: ## Open Prisma Studio
	@echo "Opening Prisma Studio..."
	cd infra/db && npx prisma studio

db-reset: ## Reset database (WARNING: destroys all data)
	@echo "Resetting database..."
	cd infra/db && npx prisma migrate reset --force

# Services health check
health: ## Check health of all services
	@echo "Checking service health..."
	@echo "PostgreSQL:" && docker exec immigration-postgres pg_isready -U immigration || echo "❌ PostgreSQL not ready"
	@echo "Redis:" && docker exec immigration-redis redis-cli ping || echo "❌ Redis not ready"
	@echo "MinIO:" && curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1 && echo "✅ MinIO ready" || echo "❌ MinIO not ready"
	@echo "Form.io:" && curl -f http://localhost:3001/health > /dev/null 2>&1 && echo "✅ Form.io ready" || echo "❌ Form.io not ready"
	@echo "DocuSeal:" && curl -f http://localhost:3002 > /dev/null 2>&1 && echo "✅ DocuSeal ready" || echo "❌ DocuSeal not ready"

# Utility commands
logs-web: ## View web app logs
	docker compose -f infra/docker/docker-compose.yml logs -f web

logs-services: ## View microservices logs
	docker compose -f infra/docker/docker-compose.yml logs -f ocr-service pdf-service uscis-service

backup-db: ## Create database backup
	@echo "Creating database backup..."
	docker exec immigration-postgres pg_dump -U immigration immigration_suite > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database from backup (specify BACKUP_FILE=filename.sql)
	@echo "Restoring database from $(BACKUP_FILE)..."
	docker exec -i immigration-postgres psql -U immigration immigration_suite < $(BACKUP_FILE)

# Quick development workflow
quick-start: ## Quick start for development (setup + dev)
	make setup
	make dev

# Production helpers
prod-build: ## Build for production
	NODE_ENV=production pnpm build

prod-check: ## Check production readiness
	@echo "Checking production readiness..."
	@echo "✓ Environment variables" && test -f .env
	@echo "✓ Build artifacts" && test -d apps/web/.next
	@echo "✓ Database connection" && make health