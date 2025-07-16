"""
Isha Voice Assistant - FastAPI Backend
Integrates LiveKit, Deepgram, Google Gemini, and MCP protocol
"""

import os
import asyncio
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx

# Voice processing imports
import livekit
from livekit import api, rtc
import google.generativeai as genai
from deepgram import DeepgramClient, PrerecordedOptions, LiveOptions
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Isha Voice Assistant API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from environment variables
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_WS_URL = os.getenv("LIVEKIT_WS_URL", "ws://localhost:7880")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nlxpyaeufqabcyimlohn.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Initialize clients
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    
if DEEPGRAM_API_KEY:
    deepgram = DeepgramClient(DEEPGRAM_API_KEY)

# Pydantic models
class VoiceSessionRequest(BaseModel):
    user_id: str
    bot_id: str
    room_name: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None

class MCPServerConfig(BaseModel):
    name: str
    url: str
    enabled: bool = True
    api_key: Optional[str] = None
    approval_mode: str = "always_ask"
    description: Optional[str] = None

class ToolCallRequest(BaseModel):
    tool_name: str
    parameters: Dict[str, Any]
    user_id: str
    bot_id: str

# In-memory storage for active sessions
active_sessions: Dict[str, Dict] = {}
mcp_servers: Dict[str, MCPServerConfig] = {}

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Bot configuration endpoints
@app.get("/api/bot/{bot_id}")
async def get_bot_config(bot_id: str):
    """Get bot configuration from Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/bots?id=eq.{bot_id}&select=*",
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

@app.get("/api/mcp-servers/{user_id}")
async def get_user_mcp_servers(user_id: str):
    """Get user's MCP servers from Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/mcp_servers?user_id=eq.{user_id}&enabled=eq.true&select=*",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch MCP servers")
                
    except Exception as e:
        logger.error(f"Error fetching MCP servers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Voice session management
@app.post("/api/voice-session/start")
async def start_voice_session(request: VoiceSessionRequest):
    """Start a new voice session with LiveKit"""
    try:
        # Get bot configuration
        bot_config = await get_bot_config(request.bot_id)
        
        # Generate LiveKit access token
        room_name = request.room_name or f"voice-session-{request.user_id}-{datetime.now().timestamp()}"
        
        if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
            raise HTTPException(status_code=500, detail="LiveKit credentials not configured")
            
        token = api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.with_identity(request.user_id)
        token.with_name(f"User-{request.user_id}")
        token.with_grants(api.VideoGrants(room_join=True, room=room_name))
        
        # Store session info
        session_id = f"{request.user_id}-{request.bot_id}-{datetime.now().timestamp()}"
        active_sessions[session_id] = {
            "user_id": request.user_id,
            "bot_id": request.bot_id,
            "room_name": room_name,
            "bot_config": bot_config,
            "created_at": datetime.now().isoformat(),
            "messages": []
        }
        
        return {
            "session_id": session_id,
            "room_name": room_name,
            "access_token": token.to_jwt(),
            "ws_url": LIVEKIT_WS_URL,
            "bot_config": bot_config
        }
        
    except Exception as e:
        logger.error(f"Error starting voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/voice-session/{session_id}")
async def end_voice_session(session_id: str):
    """End a voice session and save conversation"""
    try:
        if session_id in active_sessions:
            session = active_sessions[session_id]
            
            # Save conversation to Supabase
            if session["messages"]:
                await save_conversation_to_supabase(
                    session["user_id"],
                    session["bot_id"], 
                    session["messages"]
                )
            
            # Clean up
            del active_sessions[session_id]
            
            return {"status": "session_ended", "session_id": session_id}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
            
    except Exception as e:
        logger.error(f"Error ending voice session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Text-to-speech endpoint
@app.post("/api/tts")
async def text_to_speech(text: str, voice: str = "aura-2-thalia-en"):
    """Convert text to speech using Deepgram"""
    try:
        if not DEEPGRAM_API_KEY:
            raise HTTPException(status_code=500, detail="Deepgram API key not configured")
            
        # Use Deepgram TTS
        options = {
            "model": voice,
            "encoding": "mp3",
            "container": "mp3"
        }
        
        response = deepgram.speak.v("1").save(text, "output.mp3", options)
        
        # Return audio file or base64 encoded data
        with open("output.mp3", "rb") as audio_file:
            import base64
            audio_data = base64.b64encode(audio_file.read()).decode()
            
        return {"audio_data": audio_data, "format": "mp3"}
        
    except Exception as e:
        logger.error(f"Error in TTS: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Chat completion with Gemini
@app.post("/api/chat")
async def chat_completion(messages: List[ChatMessage], bot_id: str, user_id: str):
    """Generate chat response using Google Gemini"""
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="Gemini API key not configured")
            
        # Get bot configuration
        bot_config = await get_bot_config(bot_id)
        
        # Get user's MCP servers for tool definitions
        mcp_servers_data = await get_user_mcp_servers(user_id)
        
        # Initialize Gemini model with function calling
        model = genai.GenerativeModel(
            model_name=bot_config.get("model", "gemini-1.5-flash"),
            tools=await build_tool_definitions(mcp_servers_data)
        )
        
        # Prepare conversation history
        conversation = []
        system_prompt = f"""You are {bot_config['name']}, an AI voice assistant. 
Personality: {bot_config['personality']}

You have access to various tools through MCP servers. Use them when appropriate to help the user.
Available tools: {', '.join([server['name'] for server in mcp_servers_data])}

Always be helpful, concise, and natural in conversation."""
        
        conversation.append({"role": "user", "parts": [system_prompt]})
        
        for msg in messages:
            conversation.append({
                "role": "user" if msg.role == "user" else "model",
                "parts": [msg.content]
            })
        
        # Generate response
        chat = model.start_chat(history=conversation[:-1])
        response = chat.send_message(conversation[-1]["parts"][0])
        
        # Handle function calls if present
        if response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call'):
                    # Execute function call through MCP
                    tool_result = await execute_tool_call(part.function_call, user_id, bot_id)
                    # Send result back to continue conversation
                    response = chat.send_message(f"Tool result: {tool_result}")
        
        response_text = response.text if hasattr(response, 'text') else str(response)
        
        return {
            "response": response_text,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# MCP Protocol implementation
async def build_tool_definitions(mcp_servers_data: List[Dict]) -> List[Dict]:
    """Build tool definitions for Gemini from MCP servers"""
    tools = []
    
    # Add built-in tools
    default_tools = [
        {
            "name": "add_calendar_event",
            "description": "Add an event to Google Calendar",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Event title"},
                    "start_time": {"type": "string", "description": "Start time (ISO format)"},
                    "end_time": {"type": "string", "description": "End time (ISO format)"},
                    "description": {"type": "string", "description": "Event description"}
                },
                "required": ["title", "start_time", "end_time"]
            }
        },
        {
            "name": "send_email",
            "description": "Send an email via Gmail",
            "parameters": {
                "type": "object", 
                "properties": {
                    "to": {"type": "string", "description": "Recipient email"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body"}
                },
                "required": ["to", "subject", "body"]
            }
        },
        {
            "name": "search_web",
            "description": "Search the web using Perplexity AI",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"}
                },
                "required": ["query"]
            }
        }
    ]
    
    tools.extend(default_tools)
    
    # Add custom MCP server tools
    for server in mcp_servers_data:
        if server.get("enabled", True):
            # Fetch tool definitions from MCP server
            try:
                server_tools = await fetch_mcp_tools(server)
                tools.extend(server_tools)
            except Exception as e:
                logger.warning(f"Failed to fetch tools from {server['name']}: {e}")
    
    return tools

async def fetch_mcp_tools(server: Dict) -> List[Dict]:
    """Fetch available tools from an MCP server"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{server['url']}/tools")
            if response.status_code == 200:
                return response.json().get("tools", [])
            return []
    except Exception as e:
        logger.error(f"Error fetching tools from {server['name']}: {e}")
        return []

async def execute_tool_call(function_call: Any, user_id: str, bot_id: str) -> str:
    """Execute a tool call through appropriate MCP server"""
    try:
        tool_name = function_call.name
        parameters = dict(function_call.args)
        
        # Route to appropriate handler
        if tool_name == "add_calendar_event":
            return await handle_calendar_event(parameters, user_id)
        elif tool_name == "send_email":
            return await handle_send_email(parameters, user_id)
        elif tool_name == "search_web":
            return await handle_web_search(parameters)
        else:
            # Try custom MCP servers
            return await handle_custom_mcp_call(tool_name, parameters, user_id)
            
    except Exception as e:
        logger.error(f"Error executing tool call: {e}")
        return f"Error executing {tool_name}: {str(e)}"

# Tool handlers (placeholders - need actual API integrations)
async def handle_calendar_event(parameters: Dict, user_id: str) -> str:
    """Handle Google Calendar event creation"""
    # TODO: Implement Google Calendar API integration
    return f"Calendar event '{parameters['title']}' would be created"

async def handle_send_email(parameters: Dict, user_id: str) -> str:
    """Handle Gmail email sending"""
    # TODO: Implement Gmail API integration
    return f"Email to {parameters['to']} would be sent"

async def handle_web_search(parameters: Dict) -> str:
    """Handle web search via Perplexity"""
    # TODO: Implement Perplexity API integration
    return f"Search results for: {parameters['query']}"

async def handle_custom_mcp_call(tool_name: str, parameters: Dict, user_id: str) -> str:
    """Handle calls to custom MCP servers"""
    # TODO: Implement MCP protocol calls
    return f"Custom tool {tool_name} executed with parameters: {parameters}"

async def save_conversation_to_supabase(user_id: str, bot_id: str, messages: List[Dict]):
    """Save conversation to Supabase"""
    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json"
            }
            
            conversation_data = {
                "user_id": user_id,
                "bot_id": bot_id,
                "messages": messages,
                "timestamp": datetime.now().isoformat()
            }
            
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/conversations",
                headers=headers,
                json=conversation_data
            )
            
            if response.status_code != 201:
                logger.error(f"Failed to save conversation: {response.text}")
                
    except Exception as e:
        logger.error(f"Error saving conversation: {e}")

# WebSocket for real-time communication
@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time voice communication"""
    await websocket.accept()
    
    try:
        if session_id not in active_sessions:
            await websocket.send_json({"error": "Invalid session"})
            return
            
        session = active_sessions[session_id]
        
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "audio":
                # Process audio data with Deepgram STT
                text = await process_audio_stt(data["audio"])
                
                if text:
                    # Add user message
                    user_msg = ChatMessage(role="user", content=text)
                    session["messages"].append(user_msg.dict())
                    
                    # Generate bot response
                    response = await chat_completion(
                        [ChatMessage(**msg) for msg in session["messages"]],
                        session["bot_id"],
                        session["user_id"]
                    )
                    
                    # Add bot message
                    bot_msg = ChatMessage(role="assistant", content=response["response"])
                    session["messages"].append(bot_msg.dict())
                    
                    # Convert to speech if auto_speak is enabled
                    if session["bot_config"].get("auto_speak", True):
                        audio_response = await text_to_speech(
                            response["response"], 
                            session["bot_config"].get("voice", "aura-2-thalia-en")
                        )
                        
                        await websocket.send_json({
                            "type": "response",
                            "text": response["response"],
                            "audio": audio_response["audio_data"]
                        })
                    else:
                        await websocket.send_json({
                            "type": "response", 
                            "text": response["response"]
                        })
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_json({"error": str(e)})

async def process_audio_stt(audio_data: str) -> str:
    """Process audio data with Deepgram STT"""
    try:
        if not DEEPGRAM_API_KEY:
            return ""
            
        # Decode base64 audio
        import base64
        audio_bytes = base64.b64decode(audio_data)
        
        # Configure Deepgram
        options = PrerecordedOptions(
            model="nova-2-general",
            smart_format=True,
            utterances=True,
            punctuate=True,
            diarize=True,
        )
        
        # Process with Deepgram
        response = deepgram.listen.prerecorded.v("1").transcribe_file(
            {"buffer": audio_bytes, "mimetype": "audio/webm"},
            options
        )
        
        # Extract transcript
        if response.results and response.results.channels:
            alternatives = response.results.channels[0].alternatives
            if alternatives:
                return alternatives[0].transcript
                
        return ""
        
    except Exception as e:
        logger.error(f"Error in STT processing: {e}")
        return ""

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )