# Video Consultation Service

## Overview
The Video Consultation Service provides secure video calling capabilities with real-time translation for immigration consultations, enabling seamless communication between clients and attorneys regardless of language barriers.

## Features
- **Secure Video Calls**: End-to-end encrypted video consultations
- **Real-Time Translation**: Live translation during video calls
- **Screen Sharing**: Share documents and screens during consultations
- **Session Recording**: Record consultations for later review (with consent)
- **Multi-Language Support**: Support for 50+ languages
- **Room Management**: Create and manage consultation rooms
- **WebRTC Technology**: High-quality, low-latency video communication

## API Endpoints
- `POST /api/rooms/create` - Create consultation room
- `GET /api/rooms/:roomId` - Get room details
- `POST /api/rooms/:roomId/join` - Join consultation room
- `POST /api/rooms/:roomId/leave` - Leave consultation room
- `POST /api/translation/enable` - Enable real-time translation
- `POST /api/recordings/start` - Start session recording
- `POST /api/recordings/stop` - Stop session recording

## Environment Variables
```
PORT=3013
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_API_KEY=your_twilio_api_key
TWILIO_API_SECRET=your_twilio_api_secret
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_certificate
GOOGLE_TRANSLATE_API_KEY=your_translate_key
DATABASE_URL=your_database_url
```

## Getting Started
1. Install dependencies: `pnpm install`
2. Set up environment variables
3. Start development: `pnpm dev`

## Technologies
- WebRTC with Twilio/Agora
- Socket.IO for real-time communication
- Google Translate API for live translation
- Express.js and TypeScript
