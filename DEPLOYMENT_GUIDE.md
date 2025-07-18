# LiveKit Voice Bot Deployment Guide

## Overview
This guide explains how to deploy the complete LiveKit Agents voice bot system. The frontend runs in Lovable, while the backend requires external deployment.

## Architecture
```
Frontend (Lovable) → LiveKit Cloud ← Backend (Python Agents)
                         ↓
                   Deepgram + Gemini 2.0 Flash
```

## Step 1: Frontend Setup (Already Complete)
✅ The Lovable frontend is already configured with:
- LiveKit React SDK integration
- Token generation via Supabase Edge Functions  
- Real-time room connection and audio handling
- Chat history and conversation management

## Step 2: Backend Deployment (Required)

### Deploy to Railway (Recommended)
1. Fork this repository or copy the `backend/` folder
2. Create a new Railway project
3. Connect your repository
4. Set environment variables in Railway dashboard:
   ```
   LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
   LIVEKIT_API_KEY=your-api-key
   LIVEKIT_API_SECRET=your-api-secret
   DEEPGRAM_API_KEY=your-deepgram-key
   GOOGLE_API_KEY=your-gemini-key
   ```
5. Deploy using the provided `Dockerfile`

### Deploy to Render
1. Create new Web Service in Render
2. Connect your repository
3. Set build command: `pip install -r backend/requirements.txt`
4. Set start command: `cd backend && python livekit_agent.py dev`
5. Add environment variables (same as above)

### Deploy to Heroku
1. Create new Heroku app
2. Set buildpack to Python
3. Add environment variables via Heroku CLI or dashboard
4. Deploy using git push

## Step 3: LiveKit Cloud Setup

### Create LiveKit Cloud Project
1. Go to https://cloud.livekit.io
2. Create new project
3. Note your WebSocket URL, API Key, and API Secret
4. Update Supabase secrets with these values

### Configure Project Settings
- Enable required features in LiveKit dashboard
- Set up webhooks if needed for advanced features
- Configure room settings and participant limits

## Step 4: API Keys Configuration

### Required Services
1. **LiveKit Cloud**: WebSocket URL, API Key, Secret
2. **Deepgram**: API Key for STT/TTS
3. **Google AI**: API Key for Gemini 2.0 Flash

### Update Supabase Secrets
Add these secrets in your Supabase project settings:
- `LIVEKIT_WS_URL`
- `LIVEKIT_API_KEY` 
- `LIVEKIT_API_SECRET`
- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`

## Step 5: Testing

### Test Frontend
1. Navigate to `/voice` in your Lovable app
2. Click "Start Voice Call"
3. Verify LiveKit token generation

### Test Backend  
1. Ensure Python backend is running
2. Check logs for successful LiveKit connection
3. Verify agent joins rooms automatically

### Test End-to-End
1. Start voice call from frontend
2. Speak into microphone
3. Verify transcript appears in chat
4. Confirm AI response and speech synthesis

## Step 6: Monitoring & Scaling

### LiveKit Cloud Dashboard
- Monitor active rooms and participants
- View usage statistics and billing
- Check connection health and latency

### Backend Monitoring
- Monitor Python backend logs
- Check memory and CPU usage
- Scale horizontally as needed

### Performance Optimization
- Ensure backend is deployed in same region as LiveKit
- Monitor end-to-end latency (<500ms target)
- Optimize model parameters for speed vs quality

## Troubleshooting

### Common Issues
1. **Token Generation Fails**: Check LiveKit credentials in Supabase
2. **Backend Not Connecting**: Verify environment variables
3. **No Audio Response**: Check Deepgram API key and quotas
4. **Slow Responses**: Verify regional deployment proximity

### Debug Commands
```bash
# Check backend logs
docker logs <container-id>

# Test LiveKit connection
livekit-cli test-connection --url wss://... --key ... --secret ...

# Test Deepgram API
curl -X POST https://api.deepgram.com/v1/listen \
  -H "Authorization: Token YOUR_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @test.wav
```

## Production Considerations

### Security
- Use environment variables for all secrets
- Implement proper authentication for backend endpoints
- Enable HTTPS/WSS for all connections

### Scaling
- Deploy backend across multiple regions
- Implement load balancing for high traffic
- Monitor and set up auto-scaling policies

### Reliability
- Implement health checks and monitoring
- Set up alerting for service disruptions
- Plan for graceful degradation during outages

## Cost Optimization

### LiveKit Cloud
- Monitor participant minutes and data transfer
- Optimize room settings to reduce bandwidth
- Implement proper room cleanup

### AI Services
- Monitor API usage for Deepgram and Gemini
- Implement caching where appropriate
- Set usage alerts and quotas

This completes the deployment setup for your LiveKit Agents voice bot!