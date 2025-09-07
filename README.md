# Immigration Suite

A **multilingual immigration assistant** that provides end-to-end support for immigration applications with OCR document processing, AI form-filling, e-signatures, and live translation capabilities.

## Features

- 🌍 **Multilingual Support**: Arabic, Spanish, French, English with RTL support
- 📝 **Smart Forms**: USWDS-styled forms with Form.io CE integration
- 📄 **OCR Processing**: Automatic document extraction and form pre-filling
- 📋 **PDF Generation**: USCIS form filling (I-485, I-130, etc.)
- ✍️ **E-Signatures**: DocuSeal integration for packet signing
- 📊 **Case Tracking**: USCIS case status monitoring
- 🎙️ **Live Translation**: Optional voice translation for calls (white-label SKU)
- 🔒 **Security**: PII encryption, audit logging, compliance features

## Architecture

```
immigration-suite/
├── apps/
│   ├── web/                 # Next.js frontend (USWDS + i18n)
│   └── admin/              # Admin dashboard
├── services/
│   ├── ocr-service/        # FastAPI + PaddleOCR/docTR
│   ├── pdf-service/        # FastAPI + PyPDFForm
│   ├── uscis-service/      # Case status tracking
│   ├── voice-relay/        # LiveKit + STT/TTS (optional)
│   └── signer/             # DocuSeal configuration
├── packages/
│   └── shared/             # Types, validation, i18n
└── infra/
    ├── docker/             # Docker Compose setup
    └── db/                 # Database migrations
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Docker & Docker Compose
- Make (optional, for convenience commands)

### Installation

1. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd immigration-suite
   make setup
   ```

2. **Start development:**
   ```bash
   make dev
   ```

3. **Access services:**
   - Web App: http://localhost:3000
   - Form.io: http://localhost:3001
   - DocuSeal: http://localhost:3002
   - Adminer: http://localhost:8080
   - MinIO Console: http://localhost:9001

### Manual Setup

```bash
# Copy environment variables
cp .env.example .env

# Install dependencies
pnpm install

# Start infrastructure services
docker compose -f infra/docker/docker-compose.yml up -d

# Wait for services, then run migrations
sleep 10
make db-migrate

# Start development servers
pnpm dev
```

## Available Commands

### Development
- `make dev` - Start all development servers
- `make build` - Build all applications
- `make test` - Run test suites
- `make lint` - Run code linting

### Infrastructure  
- `make docker-up` - Start Docker services
- `make docker-down` - Stop Docker services
- `make docker-logs` - View service logs
- `make health` - Check service health

### Database
- `make db-migrate` - Run database migrations  
- `make db-studio` - Open Prisma Studio
- `make db-reset` - Reset database (⚠️ destroys data)

### Utilities
- `make clean` - Clean dependencies and containers
- `make backup-db` - Create database backup
- `make quick-start` - Complete setup + dev start

## Services

### Core Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Caching and sessions |
| MinIO | 9000/9001 | S3-compatible storage |
| Form.io | 3001 | Form builder and renderer |
| DocuSeal | 3002 | E-signature platform |
| MongoDB | 27017 | Form.io backend storage |

### Application Services (when built)

| Service | Port | Description |
|---------|------|-------------|
| Web App | 3000 | Main frontend application |
| Admin | 3003 | Operations dashboard |
| OCR Service | 8001 | Document processing API |
| PDF Service | 8002 | Form filling API |
| USCIS Service | 8003 | Case status tracking |
| Voice Relay | 8004 | Translation service (optional) |

## Environment Configuration

Copy `.env.example` to `.env` and configure:

### Required Configuration
- Database credentials
- Storage settings (MinIO)
- Form.io authentication
- DocuSeal signing keys

### Optional Configuration  
- USCIS API credentials
- SMTP/SMS for notifications
- Voice translation settings
- Security and audit settings

## Development Workflow

1. **Module Development**: Each module is developed incrementally
2. **Service Independence**: Microservices can be developed separately  
3. **Database First**: Migrations define the canonical schema
4. **API Contracts**: OpenAPI specs for service communication
5. **Testing**: Unit tests + integration tests per module
6. **Internationalization**: All UI text externalized for translation

## Production Deployment

```bash
# Build production assets
make prod-build

# Check production readiness  
make prod-check

# Deploy with production compose file
docker compose -f infra/docker/docker-compose.prod.yml up -d
```

## Security & Compliance

- 🔐 **Data Encryption**: PII encrypted at rest
- 📋 **Audit Logging**: Complete provenance tracking  
- ⏰ **Data Retention**: Configurable retention policies
- 🛡️ **Access Control**: Role-based permissions
- 📊 **Compliance**: GDPR/CCPA ready with consent flows

## Contributing

1. Choose a module to work on
2. Follow the development workflow
3. Ensure tests pass: `make test`
4. Check linting: `make lint`  
5. Verify services health: `make health`

## Support

- Documentation: [Internal Wiki]
- Issues: Create GitHub issue with module label
- Architecture questions: See `docs/architecture.md`

---

**Cost-Optimized**: Built with open-source components to minimize operational costs while maintaining enterprise capabilities.