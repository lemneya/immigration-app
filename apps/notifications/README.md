# Notification Service

## Overview
The Notification Service handles SMS, email reminders, and real-time alerts for the Immigration Suite, ensuring clients and staff stay informed about important updates and deadlines.

## Features
- **Email Notifications**: HTML email templates and delivery
- **SMS Messaging**: Text message notifications via Twilio
- **Push Notifications**: Mobile app push notifications
- **Scheduled Reminders**: Automated deadline reminders
- **Template System**: Customizable notification templates
- **Multi-Language**: Notifications in multiple languages
- **Delivery Tracking**: Track notification delivery status
- **Queue Management**: Background job processing

## API Endpoints
- `POST /api/notifications/email` - Send email notification
- `POST /api/notifications/sms` - Send SMS notification
- `POST /api/notifications/push` - Send push notification
- `POST /api/reminders/schedule` - Schedule reminder
- `GET /api/templates` - Get notification templates

## Environment Variables
```
PORT=3016
EMAIL_HOST=your_smtp_host
EMAIL_USER=your_smtp_user
EMAIL_PASS=your_smtp_password
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
FIREBASE_SERVICE_ACCOUNT=your_firebase_key
REDIS_URL=your_redis_url
```

## Getting Started
1. Install dependencies: `pnpm install`
2. Set up environment variables
3. Start development: `pnpm dev`

## Technologies
- Nodemailer for email
- Twilio for SMS
- Firebase for push notifications
- Bull for job queues
- Handlebars for templates
