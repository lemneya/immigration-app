# AI Chatbot Service

## Overview
The AI Chatbot Service provides intelligent, multi-language immigration assistance through conversational AI, helping users navigate complex immigration processes with real-time support and guidance.

## Features
- **Multi-Language Support**: Real-time translation and conversation in 50+ languages
- **Immigration Expertise**: Specialized AI trained on immigration law and procedures
- **Real-Time Chat**: WebSocket-based instant messaging with AI responses
- **Context Awareness**: Maintains conversation history and user context
- **Knowledge Base Integration**: Access to comprehensive immigration guides and FAQ
- **Sentiment Analysis**: Understands user emotions and adjusts responses accordingly
- **Natural Language Processing**: Advanced NLP for better understanding of user queries
- **Intent Recognition**: Identifies user intentions to provide targeted assistance

## AI Models Supported
- **OpenAI GPT-4**: Advanced reasoning and conversation
- **Anthropic Claude**: Ethical AI with strong immigration knowledge
- **LangChain Integration**: Orchestrated AI workflows and chains
- **Custom NLP Models**: Domain-specific immigration processing

## API Endpoints

### Chat
- `POST /api/chat/message` - Send message to AI chatbot
- `GET /api/chat/history/:userId` - Get chat history
- `POST /api/chat/conversation/start` - Start new conversation
- `POST /api/chat/conversation/end` - End conversation
- `GET /api/chat/conversation/:conversationId` - Get conversation context

### Translation
- `POST /api/translation/translate` - Translate text
- `POST /api/translation/detect-language` - Detect language
- `GET /api/translation/languages` - Get supported languages
- `POST /api/translation/translate/batch` - Bulk translation

### Knowledge Base
- `GET /api/knowledge/search` - Search knowledge base
- `GET /api/knowledge/faq` - Get FAQ
- `GET /api/knowledge/guides` - Get immigration guides
- `GET /api/knowledge/guides/:category` - Get guide by category
- `POST /api/knowledge/update` - Update knowledge base

## WebSocket Events
- `chat-message` - Send message to AI
- `chat-response` - Receive AI response
- `typing-start` - AI is typing
- `typing-stop` - AI stopped typing
- `conversation-end` - End conversation

## Environment Variables
```
PORT=3012
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
REDIS_URL=redis://localhost:6379
DATABASE_URL=your_database_connection_string
NODE_ENV=development|production
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
- Built with Express.js, TypeScript, and Socket.IO
- Integrates with OpenAI, Anthropic, and Google Translate APIs
- Uses LangChain for AI workflow orchestration
- Redis for conversation caching and session management
- Comprehensive NLP processing with multiple libraries
- Real-time WebSocket communication for instant responses