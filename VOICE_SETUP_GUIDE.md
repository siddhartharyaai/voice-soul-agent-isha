# 🎤 Isha Voice Assistant - Complete Setup Guide

This guide will walk you through setting up your voice assistant with all required API keys and configurations.

## 🔑 Required API Keys

You need to configure these API keys in your Supabase project:

### 1. **GEMINI_API_KEY** (Google AI)
- **Purpose**: Powers the AI conversations and responses
- **Get it at**: https://makersuite.google.com/app/apikey
- **Steps**:
  1. Go to Google AI Studio
  2. Click "Get API Key"
  3. Create a new project or use existing
  4. Copy your API key

### 2. **DEEPGRAM_API_KEY** (Speech Processing)
- **Purpose**: Speech-to-text and text-to-speech conversion
- **Get it at**: https://console.deepgram.com/
- **Steps**:
  1. Sign up for Deepgram account
  2. Go to API Keys section
  3. Create a new API key
  4. Copy your API key

### 3. **LIVEKIT Configuration** (Real-time Communication)
- **Purpose**: Real-time voice communication and WebRTC
- **Get it at**: https://cloud.livekit.io/
- **Keys needed**:
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `LIVEKIT_WS_URL` (format: `wss://your-project.livekit.cloud`)

## 🔧 Setup Instructions

### Step 1: Configure Supabase Secrets

1. **Open Supabase Dashboard**:
   - Go to: https://supabase.com/dashboard/project/nlxpyaeufqabcyimlohn/settings/api

2. **Add Each Secret**:
   - Click "Add new secret"
   - Enter the secret name exactly as shown above
   - Paste your API key value
   - Click "Save"

3. **Required Secrets to Add**:
   ```
   GEMINI_API_KEY=your_gemini_key_here
   DEEPGRAM_API_KEY=your_deepgram_key_here
   LIVEKIT_API_KEY=your_livekit_key_here
   LIVEKIT_API_SECRET=your_livekit_secret_here
   LIVEKIT_WS_URL=wss://your-project.livekit.cloud
   ```

### Step 2: Start the Backend Server

1. **Open Terminal** in your project root directory

2. **Start the Backend**:
   ```bash
   python start_backend.py
   ```

3. **Wait for Success Messages**:
   ```
   ✅ Environment validation passed
   🚀 Starting FastAPI server...
   🌐 Server will be available at: http://localhost:8000
   ```

4. **Verify Backend Health**:
   - Open: http://localhost:8000/health
   - Should show all services as `true`

### Step 3: Test Voice Functionality

1. **Open the App**: http://localhost:5173

2. **Sign In** to your account

3. **Click the Microphone Button**

4. **Allow Microphone Access** when prompted

5. **Say "Hello"** to test the complete pipeline:
   - Your speech → Deepgram STT → Gemini AI → Deepgram TTS → Audio response

## 🧪 Testing & Verification

### Run Complete Test Suite
```bash
python test_complete_voice_flow.py
```

### Manual Health Checks
```bash
# Backend health
curl http://localhost:8000/health

# Environment validation
curl http://localhost:8000/api/environment/validate

# Detailed health check
python backend/health_check.py
```

## 🚨 Troubleshooting

### ❌ "Voice session failed - failed to fetch"
**Cause**: Backend not running or not accessible
**Solution**: 
```bash
python start_backend.py
```

### ❌ "Required API keys not configured"
**Cause**: Missing API keys in Supabase secrets
**Solution**: Add all required keys to Supabase dashboard

### ❌ "WebSocket connection failed"
**Cause**: Backend not accessible on WebSocket port
**Solution**: Check firewall/port 8000 accessibility

### ❌ "Microphone access denied"
**Cause**: Browser blocked microphone access
**Solution**: Click 🔒 icon in address bar → Allow microphone

## 🎯 Expected Success Flow

1. ✅ Backend starts without errors
2. ✅ Health check shows all services `true`
3. ✅ Microphone button works without "Failed to fetch"
4. ✅ Voice session starts successfully
5. ✅ Real-time transcription appears when speaking
6. ✅ Bot responds with both text and audio
7. ✅ Complete voice loop: Speech → AI → Audio response

## 📞 Need Help?

If you're still having issues:

1. **Check the logs** in your terminal for error messages
2. **Run the test suite**: `python test_complete_voice_flow.py`
3. **Verify API keys** are correctly added to Supabase
4. **Make sure backend is running** on port 8000

Your voice assistant should now work seamlessly! 🎉