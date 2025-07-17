# Isha Voice Assistant - Complete 11.ai Replica

## 🚀 Quick Start

### Development Setup
```bash
# Frontend
npm install && npm run dev

# Backend
cd backend && pip install -r requirements.txt && python main.py
```

### Required API Keys
- **Gemini API**: Get from https://aistudio.google.com/app/apikey
- **Deepgram API**: Get from https://console.deepgram.com/project/_/keys
- **LiveKit**: Get from https://cloud.livekit.io/

### Test Flows
1. **Auth**: Sign up/login with Google OAuth or email
2. **API Keys**: Settings → Configure Gemini & Deepgram keys
3. **Voice Chat**: Click mic → Grant permissions → Start talking
4. **MCP Servers**: Settings → Add integration servers

## 🏗️ Deployment

### Frontend (Vercel - Free)
```bash
vercel --prod
```

### Backend (Render - $5/mo)
- Connect GitHub repo
- Build: `pip install -r backend/requirements.txt`
- Start: `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port $PORT`

## ✅ Features Complete
- ✅ Google OAuth + Email auth
- ✅ Encrypted API key storage
- ✅ Real-time voice conversation
- ✅ MCP server integration
- ✅ Mobile responsive design
- ✅ Production deployment ready

**Total Cost**: ~$5/month (Render only, rest free tier)