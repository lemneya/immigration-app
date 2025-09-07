# OCR Microservice

A high-performance OCR service that extracts structured data from immigration documents using PaddleOCR and docTR engines.

## Features

- **Dual OCR Engines**: PaddleOCR and docTR with automatic fallback
- **Document Type Recognition**: Passport, Driver License, Birth Certificate, etc.
- **Field Extraction**: Intelligent field mapping with confidence scoring
- **Multi-language Support**: English, Spanish, French, Arabic, and more
- **Canonical Mapping**: Direct integration with shared schemas
- **GPU Acceleration**: CUDA support for faster processing

## Quick Start

### Development (Node.js only)

```bash
# Start OCR service in development mode
cd apps/ocr
pnpm dev
```

The service will run in simulation mode without actual OCR engines.

### Production with Docker

```bash
# Start complete OCR stack (requires NVIDIA GPU for optimal performance)
pnpm ocr:up

# Check logs
pnpm ocr:logs

# Stop services
pnpm ocr:down
```

## API Endpoints

### POST /ocr/process

Process a document and extract structured fields.

```bash
curl -X POST http://localhost:3002/ocr/process \
  -F "document=@passport.jpg" \
  -F "documentType=passport" \
  -F "language=en" \
  -F "confidence_threshold=0.7"
```

Response:
```json
{
  "success": true,
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "ocr_results": {...},
  "extracted_fields": [...],
  "processed_data": {...},
  "metadata": {
    "processing_time": 1250,
    "language_detected": "en",
    "pages_processed": 1,
    "confidence_average": 0.87
  }
}
```

### POST /ocr/extract-text

Extract raw text without field structuring.

```bash
curl -X POST http://localhost:3002/ocr/extract-text \
  -F "document=@document.pdf" \
  -F "language=en"
```

### GET /ocr/capabilities

Get service capabilities and supported formats.

```bash
curl http://localhost:3002/ocr/capabilities
```

## Supported Documents

- **passport**: Passport documents (all countries)
- **driver_license**: US Driver Licenses
- **id_card**: National ID cards
- **birth_certificate**: Birth certificates
- **marriage_certificate**: Marriage certificates
- **divorce_decree**: Divorce decrees
- **naturalization_certificate**: Naturalization certificates
- **green_card**: US Green Cards
- **general_document**: Any document (basic text extraction)

## Supported Languages

- **en**: English
- **es**: Spanish (Español)
- **fr**: French (Français)
- **ar**: Arabic (العربية)
- **zh**: Chinese (中文)
- **hi**: Hindi (हिन्दी)
- **pt**: Portuguese (Português)
- **ru**: Russian (Русский)
- **ja**: Japanese (日本語)
- **ko**: Korean (한국어)

## Configuration

Environment variables:

```bash
PORT=3002                           # Service port
PADDLEOCR_URL=http://localhost:8001 # PaddleOCR engine URL
DOCTR_URL=http://localhost:8002     # docTR engine URL
FALLBACK_ENGINE=paddleocr           # Primary engine preference
DEFAULT_CONFIDENCE_THRESHOLD=0.7    # Default confidence filter
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│   OCR Service    │───▶│  PaddleOCR/docTR│
└─────────────────┘    │   (Node.js)      │    │   (Python API)  │
                       └─────────┬────────┘    └─────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ Canonical Data  │
                       │    (Shared)     │
                       └─────────────────┘
```

## Field Extraction

The service uses sophisticated field extraction techniques:

1. **Pattern Matching**: Regex-based extraction for structured documents
2. **Keyword Proximity**: Find values near known field labels
3. **Position-based**: Extract fields from expected document regions
4. **ML Inference**: Use confidence scores to validate extracted data

## Data Flow

1. **Document Upload**: Client uploads document image/PDF
2. **OCR Processing**: Extract raw text and bounding boxes
3. **Field Extraction**: Identify and extract specific fields
4. **Validation**: Apply confidence thresholds and validation rules
5. **Canonical Mapping**: Transform to standard schema format
6. **Response**: Return structured data with provenance

## Performance

- **Processing Time**: 1-3 seconds per document page
- **Confidence Thresholds**: Configurable per field type
- **GPU Acceleration**: 3-5x faster with NVIDIA GPU
- **Batch Processing**: Support for multiple documents

## Error Handling

The service includes robust error handling:

- Engine fallback (PaddleOCR ↔ docTR)
- Graceful degradation to simulation mode
- Detailed error reporting with confidence scores
- Retry logic for transient failures

## Monitoring

Health check endpoint:
```bash
curl http://localhost:3002/health
```

Logs are structured JSON for easy monitoring:
```json
{
  "level": "info",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "service": "ocr",
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "processing_time": 1250,
  "fields_extracted": 8,
  "confidence_average": 0.87
}
```