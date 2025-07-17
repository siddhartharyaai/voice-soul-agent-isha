# Isha Voice Assistant

A sophisticated AI voice assistant with real-time voice processing, external tool integrations, and custom workflow capabilities.

## Features

- 🎤 **Real-time Voice Processing**: LiveKit integration with Deepgram STT and TTS
- 🧠 **Google Gemini LLM**: Advanced language model with function calling
- 🔧 **MCP Protocol**: Secure tool integration framework
- 🌐 **Built-in Tools**: Calendar, Gmail, Search, Weather, and more
- ⚙️ **Custom Workflows**: User-defined MCP servers and automations
- 🎛️ **Supabase Backend**: User authentication and data persistence

## Quick Start

### Prerequisites

- Node.js 18+ 
- Python 3.9+
- Supabase account
- API keys for: Deepgram, Google Gemini, OpenWeatherMap (optional: Perplexity, Google Search)

### 1. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Backend Setup

```bash
# Quick start (automatically sets up virtual environment)
python start_backend.py

# Or manual setup:
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python start_server.py
```

### 3. Environment Configuration

Copy `backend/.env.example` to `backend/.env` and configure:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
SUPABASE_URL=https://nlxpyaeufqabcyimlohn.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional (for extended functionality)
PERPLEXITY_API_KEY=your_perplexity_key
OPENWEATHER_API_KEY=your_openweather_key
GOOGLE_SEARCH_API_KEY=your_google_search_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
```

## Architecture

### Frontend (React + TypeScript)
- **Voice Interface**: Real-time audio streaming and playback
- **Bot Management**: Create and configure multiple AI assistants
- **MCP Server Management**: Add custom tool integrations
- **Settings Panel**: Voice, personality, and integration configuration

### Backend (FastAPI + Python)
- **Voice Processing**: Deepgram STT/TTS with Silero VAD
- **LLM Integration**: Google Gemini with function calling
- **MCP Protocol**: Secure tool execution framework
- **Real-time Communication**: WebSocket support for voice sessions

### Built-in Tools

1. **Google Calendar** - Schedule and view events
2. **Gmail** - Send and read emails
3. **Perplexity Search** - Web search with AI summarization
4. **Weather** - Current conditions and forecasts
5. **Activepieces** - Custom workflow automation

## Usage

1. **Create a Bot**: Configure name, personality, voice, and model
2. **Add MCP Servers**: Extend capabilities with custom tools
3. **Start Voice Session**: Click the microphone to begin conversation
4. **Voice Commands**: "Schedule a meeting tomorrow at 2 PM" or "What's the weather like?"

## MCP Server Integration

Add custom MCP servers through the Settings panel:

- **Preset Integrations**: Activepieces, Notion, Slack, Todoist
- **Custom Servers**: Any MCP-compatible endpoint
- **Approval Modes**: Always ask, auto-approve, or never execute
- **Real-time Sync**: Automatic tool discovery and updates

## Development

### Project Structure

```
├── src/                    # Frontend React app
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   ├── pages/             # Route pages
│   └── integrations/      # Supabase integration
├── backend/               # FastAPI backend
│   ├── tools/             # Built-in tool implementations
│   ├── main.py           # FastAPI application
│   ├── voice_client.py   # Voice processing
│   └── mcp_protocol.py   # MCP implementation
└── supabase/             # Database migrations
```

### API Endpoints

- `POST /api/voice-session/start` - Start voice session
- `GET /api/bot/{bot_id}` - Get bot configuration
- `GET /api/mcp-servers/{user_id}` - Get user's MCP servers
- `POST /api/chat` - Chat completion with tools
- `WebSocket /ws/{session_id}` - Real-time voice communication

## Deployment

### Local Development
```bash
# Frontend
npm run dev

# Backend
python start_backend.py
```

### Production (Vercel)
```bash
# Build frontend
npm run build

# Deploy backend (containerized)
# Configure environment variables in Vercel dashboard
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details