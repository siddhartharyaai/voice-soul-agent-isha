# Isha Voice Assistant Backend

A comprehensive FastAPI backend for the Isha voice assistant, integrating LiveKit for real-time voice, Deepgram for STT/TTS, Google Gemini for LLM, and MCP protocol for secure tool execution.

## Features

- **Real-time Voice Processing**: LiveKit integration for low-latency voice communication
- **Speech-to-Text**: Deepgram 'nova-3-general' model for accurate transcription
- **Text-to-Speech**: Deepgram 'aura-2-thalia-en' voice for natural responses
- **LLM Integration**: Google Gemini with function calling capabilities
- **MCP Protocol**: Secure tool execution with approval workflows
- **Built-in Tools**: Google Calendar, Gmail, Perplexity Search, Weather, and more
- **Custom MCP Servers**: Support for user-defined external tools
- **Supabase Integration**: User authentication and data persistence

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Required API Keys
GEMINI_API_KEY=your_gemini_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional (for LiveKit)
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_WS_URL=ws://localhost:7880

# Optional (for MCP tools)
OPENWEATHER_API_KEY=your_openweather_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
```

### 3. Start the Server

```bash
python start_server.py
```

Or run directly with uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will start at `http://localhost:8000`

### 4. API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation.

## API Endpoints

### Voice Session Management

- `POST /api/voice-session/start` - Start a new voice session
- `DELETE /api/voice-session/{session_id}` - End a voice session
- `WebSocket /ws/{session_id}` - Real-time voice communication

### Bot Configuration

- `GET /api/bot/{bot_id}` - Get bot configuration
- `GET /api/mcp-servers/{user_id}` - Get user's MCP servers

### Text Processing

- `POST /api/chat` - Generate chat response with Gemini
- `POST /api/tts` - Convert text to speech

## MCP Protocol Integration

The backend supports the Model Context Protocol (MCP) for secure tool execution:

### Built-in Tools

1. **Google Calendar**
   - Add calendar events
   - View calendar events

2. **Gmail**
   - Send emails
   - Read emails

3. **Perplexity Search**
   - Web search with AI

4. **Weather (OpenWeatherMap)**
   - Current weather
   - Weather forecast

5. **Custom MCP Servers**
   - User-defined external tools
   - Approval workflows

### Adding Custom MCP Servers

Users can add custom MCP servers through the frontend UI. The backend will:

1. Validate the server connection
2. Fetch available tools
3. Register tools for use by the LLM
4. Handle approval workflows based on server configuration

## Architecture

```
Frontend (React) 
    ↓ HTTP/WebSocket
FastAPI Backend
    ├── LiveKit (Voice Processing)
    ├── Deepgram (STT/TTS)
    ├── Google Gemini (LLM)
    ├── MCP Protocol (Tools)
    └── Supabase (Data)
```

## Development

### Project Structure

```
backend/
├── main.py              # FastAPI application
├── voice_client.py      # LiveKit voice processing
├── mcp_protocol.py      # MCP protocol implementation
├── requirements.txt     # Python dependencies
├── start_server.py      # Server startup script
└── .env                 # Environment configuration
```

### Voice Processing Flow

1. **Audio Input**: Client captures microphone audio
2. **WebSocket**: Real-time audio streaming to backend
3. **STT**: Deepgram converts speech to text
4. **LLM**: Gemini processes text and generates response
5. **Tool Calls**: MCP protocol executes tools if needed
6. **TTS**: Deepgram converts response to speech
7. **Audio Output**: Client plays generated audio

### Adding New Tools

To add a new built-in tool:

1. Define the tool schema in `mcp_protocol.py`
2. Add the tool to the default servers
3. Implement the handler function
4. Update the tool execution router

## Deployment

### Local Development

Use the provided startup script for easy development:

```bash
python start_server.py
```

### Production Deployment

For production, use a proper ASGI server:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Environment Variables

Required for production:
- `GEMINI_API_KEY`
- `DEEPGRAM_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional but recommended:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `OPENWEATHER_API_KEY`
- `PERPLEXITY_API_KEY`

## Troubleshooting

### Common Issues

1. **Import Errors**: Install dependencies with `pip install -r requirements.txt`
2. **API Key Errors**: Check that all required keys are set in `.env`
3. **WebSocket Errors**: Ensure CORS is properly configured
4. **Audio Issues**: Verify browser microphone permissions

### Logging

The backend uses Python logging. Set log level with:

```bash
export LOG_LEVEL=DEBUG
uvicorn main:app --log-level debug
```

### Health Check

Check server health at: `GET /health`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License.