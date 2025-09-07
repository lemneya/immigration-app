# PDF Fill Service

A robust service for filling USCIS PDF forms with canonical data from the Immigration Suite.

## Features

- **Form Templates**: Pre-configured USCIS forms (I-485, I-130, I-131, G-28)
- **Custom Forms**: Support for custom PDF templates with dynamic field mapping
- **Field Mapping**: Smart mapping from canonical data to PDF form fields
- **Data Transformation**: Built-in transformers for dates, phone numbers, country codes, etc.
- **Validation**: Comprehensive validation of canonical data and field values
- **Batch Processing**: Fill multiple forms in a single request
- **Preview Mode**: Preview field mappings before filling
- **Metadata**: Add processing metadata to generated PDFs

## Quick Start

### Development

```bash
# Start PDF fill service
cd apps/pdf-fill
pnpm dev
```

The service will run on port 3004.

### Production with Docker

```bash
# Build and start PDF fill service
docker build -t immigration-pdf-fill apps/pdf-fill
docker run -p 3004:3004 immigration-pdf-fill
```

## API Endpoints

### GET /health

Health check endpoint.

```bash
curl http://localhost:3004/health
```

### GET /forms/templates

Get all available form templates.

```bash
curl http://localhost:3004/forms/templates
```

### GET /forms/templates/:formType

Get information about a specific form template.

```bash
curl http://localhost:3004/forms/templates/i485
```

### POST /forms/fill/:formType

Fill a USCIS form with canonical data.

```bash
curl -X POST http://localhost:3004/forms/fill/i485 \
  -H "Content-Type: application/json" \
  -d '{
    "canonicalData": {
      "applicant": {
        "name": {
          "given_name": "John",
          "family_name": "Doe",
          "middle_name": "Michael"
        },
        "date_of_birth": "1985-01-15",
        "place_of_birth": {
          "country": "US"
        },
        "citizenship": ["US"]
      },
      "addresses": [{
        "type": "current",
        "street_address": "123 Main Street",
        "city": "Anytown",
        "us_state": "NY",
        "postal_code": "12345",
        "country": "US"
      }],
      "contact_info": {
        "email": "john.doe@example.com",
        "phone_primary": "555-123-4567"
      }
    },
    "options": {
      "flatten": true,
      "includeMetadata": true,
      "validateFields": true
    }
  }'
```

Response:
```json
{
  "success": true,
  "form_type": "i485",
  "pdf_data": "base64-encoded-pdf-data",
  "metadata": {
    "fillId": "uuid",
    "formType": "i485",
    "filledAt": "2024-01-15T10:30:00.000Z",
    "fieldsTotal": 25,
    "fieldsFilled": 23,
    "fieldsSkipped": 2,
    "fieldsErrored": 0,
    "processingTime": 1250
  },
  "field_mappings": [...],
  "validation_results": [...]
}
```

### POST /forms/fill-custom

Fill a custom PDF form with uploaded template.

```bash
curl -X POST http://localhost:3004/forms/fill-custom \
  -F "template=@custom-form.pdf" \
  -F 'canonicalData={"applicant":{"name":{"given_name":"John"}}}' \
  -F 'fieldMappings={"applicant_name":"applicant.name.given_name"}'
```

### POST /forms/preview/:formType

Preview form field mappings without filling.

```bash
curl -X POST http://localhost:3004/forms/preview/i485 \
  -H "Content-Type: application/json" \
  -d '{"canonicalData": {...}}'
```

### GET /forms/fields/:formType

Get all fields in a form template.

```bash
curl http://localhost:3004/forms/fields/i485
```

### POST /forms/batch-fill

Fill multiple forms in batch.

```bash
curl -X POST http://localhost:3004/forms/batch-fill \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "formType": "i485",
        "canonicalData": {...}
      },
      {
        "formType": "i130", 
        "canonicalData": {...}
      }
    ]
  }'
```

## Supported Forms

### I-485: Application to Register Permanent Residence

- **Purpose**: Adjust status to permanent resident
- **Pages**: 14
- **Fields**: 89
- **Key Sections**: Personal info, application type, immigration history

### I-130: Petition for Alien Relative

- **Purpose**: Petition for family member
- **Pages**: 12
- **Fields**: 67
- **Key Sections**: Petitioner info, beneficiary info, relationship

### I-131: Application for Travel Document

- **Purpose**: Request travel document
- **Pages**: 8
- **Fields**: 45
- **Key Sections**: Document type, travel purpose

### G-28: Notice of Entry of Appearance

- **Purpose**: Attorney representation
- **Pages**: 2
- **Fields**: 23
- **Key Sections**: Attorney info, client info

## Field Transformers

Built-in transformers for data formatting:

- **default**: No transformation
- **uppercase**: Convert to uppercase
- **lowercase**: Convert to lowercase
- **date_us**: Format as MM/DD/YYYY
- **date_iso**: Format as YYYY-MM-DD
- **phone_us**: Format as (555) 123-4567
- **boolean_yesno**: Convert boolean to Yes/No
- **boolean_checkbox**: Convert to checkbox value
- **country_code_to_name**: Convert US → United States

## Field Mappings

Each form has pre-configured field mappings:

```typescript
{
  pdfFieldName: 'given_name',           // Field name in PDF
  canonicalPath: 'applicant.name.given_name',  // Path in canonical data
  transformer: 'default',               // Data transformer
  required: true,                       // Whether field is required
  validation: {                         // Optional validation rules
    pattern: '^[A-Za-z\\s]{1,50}$',
    maxLength: 50
  }
}
```

## Data Flow

1. **Input**: Canonical data + form type
2. **Validation**: Validate canonical data structure
3. **Field Mapping**: Map canonical paths to PDF fields
4. **Transformation**: Apply data transformers
5. **PDF Generation**: Fill PDF form using pdf-lib
6. **Post-processing**: Flatten, add metadata
7. **Output**: Base64-encoded filled PDF

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│  PDF Fill Service│───▶│   PDF Template  │
└─────────────────┘    │   (Node.js)      │    │    (pdf-lib)    │
                       └─────────┬────────┘    └─────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ Canonical Data  │
                       │  Validation     │
                       └─────────────────┘
```

## Configuration

Environment variables:

```bash
PORT=3004                           # Service port
NODE_ENV=development               # Environment
TEMPLATES_DIR=./templates          # Template storage directory
OUTPUT_DIR=./output               # Output directory
DEFAULT_FLATTEN=true              # Flatten PDFs by default
DEFAULT_INCLUDE_METADATA=true    # Include metadata by default
DEFAULT_VALIDATE_FIELDS=true     # Validate fields by default
```

## Error Handling

The service includes comprehensive error handling:

- **Validation errors**: Invalid canonical data
- **Mapping errors**: Missing field mappings
- **PDF errors**: Template loading or processing failures
- **Field errors**: Invalid field values or types

## Performance

- **Processing Time**: 1-3 seconds per form
- **Memory Usage**: ~50MB per concurrent request
- **Concurrent Requests**: Supports multiple simultaneous fills
- **Caching**: Template caching for improved performance

## Template Management

Templates are automatically created on startup:
- Stored in `./templates` directory
- JSON metadata in `templates.json`
- Support for custom template upload
- Version management and updates

## Integration

The PDF Fill Service integrates seamlessly with:

- **OCR Service**: Use OCR-extracted data to fill forms
- **Web Application**: Direct API integration for form generation
- **E-signature Service**: Generate forms for signature workflow
- **Canonical Schema**: Full compatibility with shared data format