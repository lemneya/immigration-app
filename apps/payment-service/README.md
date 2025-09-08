# Payment Service

## Overview
The Payment Service handles all payment processing for the Immigration Suite, providing secure integration with Stripe and PayPal payment gateways.

## Features
- **Stripe Integration**: Credit card processing with Stripe's secure API
- **PayPal Integration**: PayPal payment processing and subscription management
- **Payment History**: Track and manage payment transactions
- **Subscription Management**: Recurring payment handling for service plans
- **Webhook Processing**: Handle payment status updates from payment providers
- **Refund Processing**: Automated refund management
- **Security**: PCI DSS compliant payment processing

## API Endpoints

### Payments
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/payments/paypal/create` - Create PayPal payment
- `POST /api/payments/confirm` - Confirm payment completion
- `GET /api/payments/history/:userId` - Get payment history
- `POST /api/payments/refund` - Process refund

### Subscriptions
- `POST /api/subscriptions/create` - Create subscription
- `PUT /api/subscriptions/:subscriptionId` - Update subscription
- `DELETE /api/subscriptions/:subscriptionId` - Cancel subscription
- `GET /api/subscriptions/:subscriptionId` - Get subscription details

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/paypal` - PayPal webhook handler

## Environment Variables
```
PORT=3011
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox|live
DATABASE_URL=your_database_connection_string
```

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables in `.env` file

3. Start development server:
```bash
pnpm dev
```

4. Start production server:
```bash
pnpm build
pnpm start
```

## Development
- Built with Express.js and TypeScript
- Integrates with Stripe and PayPal APIs
- Uses Prisma for database operations
- Includes comprehensive error handling and logging
- Webhook signature verification for security