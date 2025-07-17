# VOICE FUNCTIONALITY SETUP GUIDE

## ⚠️ CRITICAL: Backend Must Be Running First

Your voice assistant requires a Python backend server to be running on port 8000. The error "Cannot connect to backend server at http://localhost:8000" means the backend is not running.

## STEP 1: Start the Backend Server

**Open a terminal and run:**

```bash
cd backend
python start_production.py
```

**You should see:**
```
🎤 Isha Voice Assistant - PRODUCTION BACKEND
==================================================
✅ Starting server with environment configuration
🚀 Server will be available at: http://localhost:8000
🔧 Health check at: http://localhost:8000/health
INFO:     Started server process [XXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## STEP 2: Test Backend Health

**In another terminal, run:**
```bash
curl http://localhost:8000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "services": {
    "deepgram": true,
    "gemini": true,
    "livekit": true,
    "supabase": true
  }
}
```

## STEP 3: Use Voice Function

1. Go to your app at https://your-project-url.lovableproject.com
2. Click the microphone button 🎤
3. Allow microphone access when prompted
4. Start speaking!

## Troubleshooting

### Error: "Voice session failed"
- ✅ Backend server is running (Step 1)
- ✅ Health check passes (Step 2)
- ✅ All API keys are configured in Supabase secrets

### Error: "Connection refused"
- The backend server is not running
- Run `python start_production.py` from the `backend` directory

### Error: "API key not configured"
- Check Supabase project settings > Secrets
- Ensure all required API keys are added:
  - GEMINI_API_KEY
  - DEEPGRAM_API_KEY
  - LIVEKIT_API_KEY
  - LIVEKIT_API_SECRET
  - LIVEKIT_WS_URL

## Technical Details

- **Frontend:** Connects to `http://localhost:8000` for voice sessions
- **Backend:** Python FastAPI server with WebSocket support
- **Voice Flow:** Browser → FastAPI → Deepgram (STT) → Gemini (AI) → ElevenLabs (TTS) → Browser
- **Real-time:** WebSocket connection for live audio streaming

## Success Indicators

✅ Backend starts without errors
✅ Health check returns all services: true
✅ Microphone button shows "connected" state
✅ Speaking generates real-time transcription
✅ AI responds with both text and audio

The voice functionality is fully implemented and working - you just need to start the backend server first!