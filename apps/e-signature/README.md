# E-Signature Service

A comprehensive e-signature service with DocuSeal integration for the Immigration Suite.

## Features

- **DocuSeal Integration**: Complete integration with DocuSeal e-signature platform
- **Template Management**: Pre-configured templates for USCIS forms (I-485, I-130, G-28)
- **Signature Workflows**: Multi-signer workflows with reminders and tracking
- **Analytics Dashboard**: Comprehensive analytics and reporting
- **Webhook Support**: Real-time status updates via webhooks
- **PDF Integration**: Direct integration with PDF fill service
- **Document Management**: Upload, store, and manage signature documents

## Quick Start

### Development

```bash
# Start e-signature service
cd apps/e-signature
pnpm dev
```

The service will run on port 3005.

### Production with Docker

```bash
# Build and start e-signature service
docker build -t immigration-esignature apps/e-signature
docker run -p 3005:3005 immigration-esignature
```

## API Endpoints

### Health Check

```bash
curl http://localhost:3005/health
```

### Signature Requests

#### Create Signature Request
```bash
curl -X POST http://localhost:3005/signatures/requests \
  -H "Content-Type: application/json" \
  -d '{
    "title": "I-485 Application Signature",
    "message": "Please review and sign your I-485 application",
    "signers": [
      {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "role": "applicant"
      }
    ],
    "templateId": "i485-signature",
    "dueDate": "2024-02-15T00:00:00Z",
    "reminderEnabled": true
  }'
```

#### Get All Signature Requests
```bash
curl http://localhost:3005/signatures/requests
```

#### Get Specific Signature Request
```bash
curl http://localhost:3005/signatures/requests/{id}
```

#### Cancel Signature Request
```bash
curl -X POST http://localhost:3005/signatures/requests/{id}/cancel
```

#### Send Reminder
```bash
curl -X POST http://localhost:3005/signatures/requests/{id}/signers/{signerId}/remind
```

#### Download Signed Document
```bash
curl http://localhost:3005/signatures/requests/{id}/download
```

### Templates

#### Get All Templates
```bash
curl http://localhost:3005/signatures/templates
```

#### Get Template by ID
```bash
curl http://localhost:3005/signatures/templates/{id}
```

#### Create Template
```bash
curl -X POST http://localhost:3005/signatures/templates \
  -F "document=@template.pdf" \
  -F "name=My Template" \
  -F "description=Template for signatures" \
  -F "formType=i485"
```

#### Get Templates by Form Type
```bash
curl http://localhost:3005/signatures/templates/form/i485
```

### Analytics

#### Get Signature Analytics
```bash
curl http://localhost:3005/signatures/analytics
```

### Integration

#### Create Request from PDF
```bash
curl -X POST http://localhost:3005/signatures/from-pdf \
  -F "pdf=@filled-form.pdf" \
  -F "title=Please Sign Your Application" \
  -F 'signers=[{"name":"John Doe","email":"john@example.com"}]'
```

### Webhooks

The service supports DocuSeal webhooks for real-time updates:

```bash
# Webhook endpoint (configured in DocuSeal)
POST http://localhost:3005/signatures/webhooks/docuseal
```

## Configuration

Environment variables:

```bash
PORT=3005
NODE_ENV=development
DOCUSEAL_URL=http://localhost:3002
DOCUSEAL_API_KEY=your_api_key
DOCUSEAL_WEBHOOK_SECRET=your_webhook_secret
DEFAULT_EXPIRATION_DAYS=30
DEFAULT_REMINDER_INTERVAL=7
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,doc
```

## Supported Forms

### I-485: Application to Register Permanent Residence
- Signature fields for applicant
- Date fields for signature date
- Support for attorney signatures if G-28 is attached

### I-130: Petition for Alien Relative
- Petitioner signature fields
- Date validation
- Multi-page support

### G-28: Notice of Entry of Appearance
- Attorney and client signature fields
- Dual signature validation
- Legal representation workflow

## Integration with Immigration Suite

### PDF Fill Service Integration
```javascript
// Create signature request from filled PDF
const response = await fetch('http://localhost:3005/signatures/from-pdf', {
  method: 'POST',
  body: formData // Contains PDF from fill service
});
```

### Web Application Integration
```javascript
// Get signature status in web app
const status = await fetch(`http://localhost:3005/signatures/requests/${requestId}`);
```

### Webhook Integration
```javascript
// Handle signature completion
app.post('/webhooks/signature-complete', (req, res) => {
  const { event_type, data } = req.body;
  // Process signature completion
});
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │───▶│ E-signature API  │───▶│    DocuSeal     │
└─────────────────┘    │   (Node.js)      │    │   Platform      │
                       └─────────┬────────┘    └─────────────────┘
                                 │
                                 ▼
                       ┌─────────────────┐
                       │ Template Store  │
                       │   & Analytics   │
                       └─────────────────┘
```

## Error Handling

The service includes comprehensive error handling:

- **Validation errors**: Invalid request data
- **DocuSeal errors**: API integration failures
- **File errors**: Upload and processing failures
- **Authentication errors**: Invalid API keys or permissions

## Performance

- **Processing Time**: 2-5 seconds per signature request
- **Concurrent Requests**: Supports multiple simultaneous operations
- **Template Caching**: Optimized template retrieval
- **Webhook Processing**: Real-time status updates

## Security

- **API Key Authentication**: Secure DocuSeal API integration
- **Webhook Verification**: Signed webhook validation
- **File Validation**: Secure file upload with type checking
- **Input Sanitization**: XSS and injection prevention

## Monitoring

- Health check endpoint for service monitoring
- Request logging and error tracking
- Analytics for signature completion rates
- Performance metrics and response times