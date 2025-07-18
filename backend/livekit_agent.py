#!/usr/bin/env python3
"""
LiveKit Agents Voice Bot Implementation

This is the proper backend that should be deployed externally (Railway, Render, etc.)
since Lovable cannot run Python services directly.

Deploy this to your preferred Python hosting platform with the required environment variables.
"""

import asyncio
import os
import logging
from typing import Dict, Any
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import deepgram, google, silero

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Required environment variables
REQUIRED_VARS = [
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY", 
    "LIVEKIT_API_SECRET",
    "DEEPGRAM_API_KEY",
    "GOOGLE_API_KEY"
]

def check_environment():
    """Check that all required environment variables are set"""
    missing = [var for var in REQUIRED_VARS if not os.getenv(var)]
    if missing:
        raise ValueError(f"Missing required environment variables: {missing}")

async def entrypoint(ctx: JobContext):
    """Main entrypoint for LiveKit Agent"""
    initial_ctx = llm.ChatContext().append(
        role="system",
        text=(
            "You are Isha, a helpful AI voice assistant. "
            "Your responses should be natural, conversational, and concise. "
            "Keep responses to 1-2 sentences maximum for voice interaction. "
            "Be friendly, engaging, and helpful."
        ),
    )

    logger.info(f"Connecting to room {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Create the voice assistant with the full pipeline
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=deepgram.STT(
            model="nova-2",
            language="en-US",
            smart_format=True,
            interim_results=True,
        ),
        llm=google.LLM(
            model="gemini-2.0-flash-exp",
            temperature=0.8,
        ),
        tts=deepgram.TTS(
            model="aura-asteria-en",
            encoding="linear16",
            sample_rate=24000,
        ),
        chat_ctx=initial_ctx,
    )

    # Start the voice assistant
    assistant.start(ctx.room)

    logger.info("Voice assistant started successfully")
    
    # Keep the agent running
    await asyncio.sleep(1)
    await assistant.aclose()


if __name__ == "__main__":
    check_environment()
    
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        ),
    )