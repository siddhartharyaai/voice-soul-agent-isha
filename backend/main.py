"""
Isha Voice Assistant - Production FastAPI Backend
Complete implementation with real API integrations, OAuth, and MCP protocol
"""

import os
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, ValidationError
import httpx

# Voice processing
from voice_client import VoiceClient, AudioProcessor
from mcp_protocol import MCPProtocolHandler, MCPToolResult
from tools.google_auth import GoogleAuthManager
from tools.encryption import EncryptionManager
from config import Settings, validate_environment

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
settings = Settings()
mcp_handler = MCPProtocolHandler()
google_auth = GoogleAuthManager()
encryption = EncryptionManager()
security = HTTPBearer()

# Active voice sessions
voice_sessions: Dict[str, Dict] = {}
active_websockets: Dict[str, WebSocket] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("🚀 Starting Isha Voice Assistant Backend")
    
    # Load secrets from Supabase first
    logger.info("🔑 Loading secrets from Supabase...")
    secrets_loaded = await settings.load_secrets_from_supabase()
    
    # Validate environment after loading secrets
    validation_result = validate_environment()
    if not validation_result.is_valid:
        logger.error(f"❌ Environment validation failed: {validation_result.missing_keys}")
        if not secrets_loaded:
            logger.error("💡 Tip: Make sure to configure API keys in your Supabase project secrets")
            logger.error("   1. Go to Supabase Dashboard > Settings > API")
            logger.error("   2. Add your GEMINI_API_KEY, DEEPGRAM_API_KEY, LIVEKIT_API_KEY, etc.")
        logger.warning("⚠️ Starting with limited functionality - some features may not work")
    else:
        logger.info("✅ Environment validation passed")
    
    # Initialize MCP servers
    await mcp_handler.initialize_servers()
    logger.info("✅ MCP servers initialized")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down Isha Voice Assistant Backend")

app = FastAPI(
    title="Isha Voice Assistant API",
    version="2.0.0",
    description="Production voice AI assistant with MCP integrations",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://*.netlify.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class VoiceSessionRequest(BaseModel):
    user_id: str
    bot_id: str
    room_name: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None
    tool_calls: Optional[List[Dict]] = None

class MCPServerConfig(BaseModel):
    name: str
    url: str
    enabled: bool = True
    api_key: Optional[str] = None
    approval_mode: str = "always_ask"
    description: Optional[str] = None

class ToolApprovalRequest(BaseModel):
    call_id: str
    approved: bool
    user_id: str

class APIKeyRequest(BaseModel):
    service: str
    api_key: str
    user_id: str

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Validate JWT token and return user info"""
    try:
        # Validate with Supabase
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {credentials.credentials}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=401, detail="Invalid token")
                
    except Exception as e:
        logger.error(f"Auth validation error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# Health and status endpoints
@app.get("/health")
async def health_check():
    """Comprehensive health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0",
        "services": {
            "deepgram": bool(settings.DEEPGRAM_API_KEY),
            "gemini": bool(settings.GEMINI_API_KEY),
            "livekit": bool(settings.LIVEKIT_API_KEY),
            "supabase": bool(settings.SUPABASE_URL),
        },
        "mcp_servers": len(mcp_handler.servers),
        "active_sessions": len(voice_sessions)
    }

@app.get("/api/environment/validate")
async def validate_env():
    """Validate environment configuration"""
    result = validate_environment()
    return {
        "valid": result.is_valid,
        "missing_keys": result.missing_keys,
        "optional_missing": result.optional_missing,
        "recommendations": result.recommendations
    }

# Voice session management
@app.post("/api/voice-session/start")
async def start_voice_session(
    request: VoiceSessionRequest,
    user = Depends(get_current_user)
):
    """Start a new voice session with LiveKit"""
    try:
        # Get bot configuration from Supabase
        bot_config = await get_bot_config(request.bot_id, user["id"])
        
        # Create LiveKit room
        room_name = request.room_name or f"voice-{request.user_id}-{int(datetime.now().timestamp())}"
        
        # Initialize voice client
        voice_client = VoiceClient(
            livekit_url=settings.LIVEKIT_WS_URL,
            api_key=settings.LIVEKIT_API_KEY,
            api_secret=settings.LIVEKIT_API_SECRET
        )
        
        # Generate access token
        access_token = voice_client.generate_access_token(
            room_name=room_name,
            participant_identity=request.user_id,
            participant_name=f"User-{request.user_id}"
        )
        
        # Store session
        session_id = f"{request.user_id}-{request.bot_id}-{int(datetime.now().timestamp())}"
        voice_sessions[session_id] = {
            "user_id": request.user_id,
            "bot_id": request.bot_id,
            "room_name": room_name,
            "bot_config": bot_config,
            "voice_client": voice_client,
            "created_at": datetime.now(),
            "messages": [],
            "is_active": True
        }
        
        logger.info(f"Started voice session {session_id} for user {request.user_id}")
        
        return {
            "session_id": session_id,
            "room_name": room_name,
            "access_token": access_token,
            "ws_url": settings.LIVEKIT_WS_URL.replace("wss://", "ws://"),
            "bot_config": bot_config
        }
        
    except Exception as e:
        logger.error(f"Error starting voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/voice-session/{session_id}")
async def end_voice_session(session_id: str, user = Depends(get_current_user)):
    """End voice session and save conversation"""
    try:
        if session_id not in voice_sessions:
            raise HTTPException(status_code=404, detail="Session not found")
            
        session = voice_sessions[session_id]
        
        # Verify user owns this session
        if session["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Save conversation to Supabase
        if session["messages"]:
            await save_conversation_to_supabase(
                session["user_id"],
                session["bot_id"],
                session["messages"]
            )
        
        # Cleanup voice client
        if "voice_client" in session:
            await session["voice_client"].disconnect()
        
        # Remove session
        del voice_sessions[session_id]
        
        # Close WebSocket if active
        if session_id in active_websockets:
            await active_websockets[session_id].close()
            del active_websockets[session_id]
        
        logger.info(f"Ended voice session {session_id}")
        
        return {"status": "session_ended", "session_id": session_id}
        
    except Exception as e:
        logger.error(f"Error ending voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Real-time WebSocket for voice communication
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time voice communication"""
    await websocket.accept()
    active_websockets[session_id] = websocket
    
    try:
        if session_id not in voice_sessions:
            await websocket.send_json({"error": "Invalid session", "code": "SESSION_NOT_FOUND"})
            return
            
        session = voice_sessions[session_id]
        logger.info(f"WebSocket connected for session {session_id}")
        
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "bot_name": session["bot_config"]["name"]
        })
        
        while True:
            try:
                data = await websocket.receive_json()
                await handle_websocket_message(websocket, session_id, data)
                
            except WebSocketDisconnect:
                break
                
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
        await websocket.send_json({"error": str(e), "type": "error"})
        
    finally:
        if session_id in active_websockets:
            del active_websockets[session_id]
        logger.info(f"WebSocket disconnected for session {session_id}")

async def handle_websocket_message(websocket: WebSocket, session_id: str, data: Dict):
    """Handle incoming WebSocket messages"""
    try:
        session = voice_sessions[session_id]
        message_type = data.get("type")
        
        if message_type == "audio":
            # Process audio with Deepgram STT
            audio_data = data.get("audio")
            if audio_data:
                transcript = await process_audio_stt(audio_data)
                
                if transcript and transcript.strip():
                    # Send transcription back to client
                    await websocket.send_json({
                        "type": "transcription",
                        "text": transcript,
                        "is_final": True
                    })
                    
                    # Add user message
                    user_message = ChatMessage(role="user", content=transcript)
                    session["messages"].append(user_message.model_dump())
                    
                    # Generate bot response
                    bot_response = await generate_bot_response(session, transcript)
                    
                    if bot_response:
                        # Add bot message
                        bot_message = ChatMessage(role="assistant", content=bot_response["text"])
                        session["messages"].append(bot_message.model_dump())
                        
                        # Send response back
                        response_data = {
                            "type": "response",
                            "text": bot_response["text"],
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        # Generate TTS audio
                        if bot_response["text"] and not session.get("muted", False):
                            tts_audio = await generate_tts_audio(
                                bot_response["text"],
                                session["bot_config"].get("voice", "aura-2-thalia-en")
                            )
                            if tts_audio:
                                response_data["audio"] = tts_audio
                        
                        await websocket.send_json(response_data)
        
        elif message_type == "interrupt":
            # Handle user interruption
            session["is_interrupted"] = True
            await websocket.send_json({"type": "interrupted"})
            
        elif message_type == "toggle_mute":
            # Toggle audio output
            session["muted"] = not session.get("muted", False)
            await websocket.send_json({
                "type": "mute_status",
                "muted": session["muted"]
            })
            
        elif message_type == "text_input":
            # Handle text input
            text = data.get("text", "").strip()
            if text:
                # Add user message
                user_message = ChatMessage(role="user", content=text)
                session["messages"].append(user_message.model_dump())
                
                # Generate bot response
                bot_response = await generate_bot_response(session, text)
                
                if bot_response:
                    # Add bot message
                    bot_message = ChatMessage(role="assistant", content=bot_response["text"])
                    session["messages"].append(bot_message.model_dump())
                    
                    await websocket.send_json({
                        "type": "response",
                        "text": bot_response["text"],
                        "timestamp": datetime.now().isoformat()
                    })
        
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
        await websocket.send_json({"error": str(e), "type": "error"})

# Voice processing functions
async def process_audio_stt(audio_data: str) -> Optional[str]:
    """Process audio with Deepgram STT"""
    try:
        if not settings.DEEPGRAM_API_KEY:
            logger.warning("Deepgram API key not configured")
            return None
            
        from deepgram import DeepgramClient, PrerecordedOptions
        import base64
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data)
        
        # Initialize Deepgram client
        deepgram = DeepgramClient(settings.DEEPGRAM_API_KEY)
        
        # Configure options
        options = PrerecordedOptions(
            model="nova-2-general",
            language="en",
            punctuate=True,
            diarize=False,
            smart_format=True
        )
        
        # Process audio
        response = deepgram.listen.prerecorded.v("1").transcribe_file(
            {"buffer": audio_bytes, "mimetype": "audio/webm"},
            options
        )
        
        # Extract transcript
        if response and response.results and response.results.channels:
            alternatives = response.results.channels[0].alternatives
            if alternatives and len(alternatives) > 0:
                transcript = alternatives[0].transcript
                if transcript and transcript.strip():
                    logger.info(f"STT transcript: {transcript}")
                    return transcript.strip()
        
        return None
        
    except Exception as e:
        logger.error(f"Error in STT processing: {e}")
        return None

async def generate_tts_audio(text: str, voice: str = "aura-2-thalia-en") -> Optional[str]:
    """Generate TTS audio with Deepgram"""
    try:
        if not settings.DEEPGRAM_API_KEY or not text.strip():
            return None
            
        from deepgram import DeepgramClient, SpeakOptions
        import base64
        
        # Initialize client
        deepgram = DeepgramClient(settings.DEEPGRAM_API_KEY)
        
        # Configure options
        options = SpeakOptions(
            model=voice,
            encoding="mp3",
            container="mp3"
        )
        
        # Generate audio
        response = deepgram.speak.v("1").save(text, "temp_audio.mp3", options)
        
        # Read and encode audio file
        if os.path.exists("temp_audio.mp3"):
            with open("temp_audio.mp3", "rb") as audio_file:
                audio_data = base64.b64encode(audio_file.read()).decode()
            
            # Clean up temp file
            os.remove("temp_audio.mp3")
            
            return audio_data
        
        return None
        
    except Exception as e:
        logger.error(f"Error in TTS generation: {e}")
        return None

async def generate_bot_response(session: Dict, user_input: str) -> Optional[Dict]:
    """Generate bot response using Gemini with function calling"""
    try:
        if not settings.GEMINI_API_KEY:
            return {"text": "I'm sorry, but my language model is not configured properly."}
            
        import google.generativeai as genai
        
        # Configure Gemini
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Get available tools
        available_tools = mcp_handler.get_available_tools()
        
        # Build conversation history
        messages = session["messages"][-10:]  # Last 10 messages for context
        
        # Create system prompt
        bot_config = session["bot_config"]
        system_prompt = f"""You are {bot_config['name']}, an AI voice assistant.
        
Personality: {bot_config.get('personality', 'I am helpful, friendly, and concise.')}

You have access to these tools through MCP servers:
{', '.join([tool['name'] for tool in available_tools])}

Guidelines:
- Be conversational and natural
- Use tools when appropriate to help the user
- Keep responses concise for voice interaction
- If a tool requires approval, explain what you want to do first

Current conversation context: {len(messages)} previous messages"""
        
        # Initialize model with tools (using Gemini 2.0 Flash for enhanced performance)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash-exp",
            tools=available_tools if available_tools else None
        )
        
        # Build conversation for Gemini
        conversation = [{"role": "user", "parts": [system_prompt]}]
        
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            conversation.append({
                "role": role,
                "parts": [msg["content"]]
            })
        
        # Add current user input
        conversation.append({"role": "user", "parts": [user_input]})
        
        # Generate response
        chat = model.start_chat(history=conversation[:-1])
        response = chat.send_message(conversation[-1]["parts"][0])
        
        # Handle function calls
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    # Execute function call
                    tool_result = await mcp_handler.execute_tool(
                        tool_name=part.function_call.name,
                        arguments=dict(part.function_call.args),
                        user_id=session["user_id"]
                    )
                    
                    if tool_result.requires_approval:
                        # Return approval request
                        return {
                            "text": f"I'd like to {part.function_call.name} with the following details: {dict(part.function_call.args)}. Should I proceed?",
                            "requires_approval": True,
                            "call_id": tool_result.call_id
                        }
                    else:
                        # Continue conversation with tool result
                        response = chat.send_message(f"Tool result: {tool_result.result}")
        
        # Get final response text
        response_text = response.text if hasattr(response, 'text') else str(response)
        
        return {"text": response_text}
        
    except Exception as e:
        logger.error(f"Error generating bot response: {e}")
        return {"text": "I'm sorry, I encountered an error processing your request."}

# Tool execution and approval endpoints
@app.post("/api/tools/approve")
async def approve_tool_call(
    request: ToolApprovalRequest,
    user = Depends(get_current_user)
):
    """Approve or deny a pending tool call"""
    try:
        if request.approved:
            result = await mcp_handler.approve_tool_call(request.call_id)
            return {"status": "approved", "result": result.result, "error": result.error}
        else:
            # Remove from pending approvals
            if request.call_id in mcp_handler.pending_approvals:
                del mcp_handler.pending_approvals[request.call_id]
            return {"status": "denied", "message": "Tool call was denied by user"}
            
    except Exception as e:
        logger.error(f"Error in tool approval: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# MCP server management
@app.get("/api/mcp-servers/{user_id}")
async def get_user_mcp_servers(user_id: str, user = Depends(get_current_user)):
    """Get user's MCP servers from Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/mcp_servers?user_id=eq.{user_id}&select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch MCP servers")
                
    except Exception as e:
        logger.error(f"Error fetching MCP servers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mcp-servers")
async def add_mcp_server(
    server_config: MCPServerConfig,
    user = Depends(get_current_user)
):
    """Add a new MCP server"""
    try:
        # Add to MCP handler
        success = await mcp_handler.add_custom_server(server_config.model_dump())
        
        if success:
            # Save to Supabase
            await save_mcp_server_to_supabase(server_config, user["id"])
            return {"status": "success", "message": "MCP server added successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to add MCP server")
            
    except Exception as e:
        logger.error(f"Error adding MCP server: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# API key management
@app.post("/api/user-keys")
async def store_user_api_key(
    request: APIKeyRequest,
    user = Depends(get_current_user)
):
    """Store encrypted API key for user"""
    try:
        # Encrypt the API key
        encrypted_key = encryption.encrypt(request.api_key)
        
        # Store in Supabase (user_keys table)
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            data = {
                "user_id": request.user_id,
                "service": request.service,
                "encrypted_key": encrypted_key,
                "created_at": datetime.now().isoformat()
            }
            
            response = await client.post(
                f"{settings.SUPABASE_URL}/rest/v1/user_api_keys",
                headers=headers,
                json=data
            )
            
            if response.status_code == 201:
                return {"status": "success", "message": f"API key for {request.service} stored securely"}
            else:
                raise HTTPException(status_code=400, detail="Failed to store API key")
                
    except Exception as e:
        logger.error(f"Error storing API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Google OAuth endpoints
@app.get("/api/auth/google/url")
async def get_google_auth_url(user = Depends(get_current_user)):
    """Get Google OAuth authorization URL"""
    try:
        auth_url = google_auth.get_authorization_url(user["id"])
        return {"auth_url": auth_url}
        
    except Exception as e:
        logger.error(f"Error generating Google auth URL: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/google/callback")
async def google_auth_callback(request: Request):
    """Handle Google OAuth callback"""
    try:
        # Get authorization code from query params
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code or state parameter")
        
        # Exchange code for tokens
        tokens = await google_auth.exchange_code_for_tokens(code, state)
        
        if tokens:
            return RedirectResponse(url=f"/voice?auth=success")
        else:
            return RedirectResponse(url=f"/voice?auth=error")
            
    except Exception as e:
        logger.error(f"Error in Google OAuth callback: {e}")
        return RedirectResponse(url=f"/voice?auth=error")

# Helper functions
async def get_bot_config(bot_id: str, user_id: str) -> Dict:
    """Get bot configuration from Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/bots?id=eq.{bot_id}&user_id=eq.{user_id}&select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                bots = response.json()
                if bots:
                    return bots[0]
                else:
                    raise HTTPException(status_code=404, detail="Bot not found")
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch bot")
                
    except Exception as e:
        logger.error(f"Error fetching bot config: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def save_conversation_to_supabase(user_id: str, bot_id: str, messages: List[Dict]):
    """Save conversation to Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            conversation_data = {
                "user_id": user_id,
                "bot_id": bot_id,
                "messages": messages,
                "timestamp": datetime.now().isoformat()
            }
            
            response = await client.post(
                f"{settings.SUPABASE_URL}/rest/v1/conversations",
                headers=headers,
                json=conversation_data
            )
            
            if response.status_code != 201:
                logger.error(f"Failed to save conversation: {response.text}")
                
    except Exception as e:
        logger.error(f"Error saving conversation: {e}")

async def save_mcp_server_to_supabase(server_config: MCPServerConfig, user_id: str):
    """Save MCP server configuration to Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            # Encrypt API key if provided
            encrypted_key = None
            if server_config.api_key:
                encrypted_key = encryption.encrypt(server_config.api_key)
            
            data = {
                "user_id": user_id,
                "name": server_config.name,
                "url": server_config.url,
                "enabled": server_config.enabled,
                "api_key": encrypted_key,
                "approval_mode": server_config.approval_mode,
                "description": server_config.description
            }
            
            response = await client.post(
                f"{settings.SUPABASE_URL}/rest/v1/mcp_servers",
                headers=headers,
                json=data
            )
            
            if response.status_code != 201:
                logger.error(f"Failed to save MCP server: {response.text}")
                
    except Exception as e:
        logger.error(f"Error saving MCP server: {e}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )