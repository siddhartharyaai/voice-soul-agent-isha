"""
Configuration management and environment validation
"""

import os
import logging
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)

logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    is_valid: bool
    missing_keys: List[str]
    optional_missing: List[str]
    recommendations: List[str]

class Settings:
    """Application settings with environment validation"""
    
    def __init__(self):
        # Core FastAPI settings
        self.DEBUG = os.getenv("DEBUG", "false").lower() == "true"
        self.HOST = os.getenv("HOST", "0.0.0.0")
        self.PORT = int(os.getenv("PORT", "8000"))
        
        # Supabase configuration
        self.SUPABASE_URL = os.getenv("SUPABASE_URL")
        self.SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
        self.SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        # Core AI services (required)
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        self.DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
        
        # LiveKit configuration (required for voice)
        self.LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
        self.LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
        self.LIVEKIT_WS_URL = os.getenv("LIVEKIT_WS_URL")
        
        # Security
        self.ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
        self.JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        
        # Optional third-party APIs
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Fallback LLM
        self.PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
        self.OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
        self.NEWS_API_KEY = os.getenv("NEWS_API_KEY")
        
        # Google OAuth (optional - will prompt user if needed)
        self.GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
        self.GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
        
        # Optional social/productivity integrations
        self.SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
        self.TODOIST_API_TOKEN = os.getenv("TODOIST_API_TOKEN")
        self.GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
        self.SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
        self.SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
        self.NOTION_CLIENT_ID = os.getenv("NOTION_CLIENT_ID")
        self.NOTION_CLIENT_SECRET = os.getenv("NOTION_CLIENT_SECRET")

def validate_environment() -> ValidationResult:
    """Validate environment configuration and provide recommendations"""
    
    settings = Settings()
    
    # Required keys for basic functionality
    required_keys = [
        ("SUPABASE_URL", settings.SUPABASE_URL),
        ("SUPABASE_ANON_KEY", settings.SUPABASE_ANON_KEY),
        ("GEMINI_API_KEY", settings.GEMINI_API_KEY),
        ("DEEPGRAM_API_KEY", settings.DEEPGRAM_API_KEY),
        ("LIVEKIT_API_KEY", settings.LIVEKIT_API_KEY),
        ("LIVEKIT_API_SECRET", settings.LIVEKIT_API_SECRET),
        ("LIVEKIT_WS_URL", settings.LIVEKIT_WS_URL),
    ]
    
    # Optional but recommended keys
    optional_keys = [
        ("ENCRYPTION_KEY", settings.ENCRYPTION_KEY),
        ("PERPLEXITY_API_KEY", settings.PERPLEXITY_API_KEY),
        ("OPENWEATHER_API_KEY", settings.OPENWEATHER_API_KEY),
        ("GOOGLE_CLIENT_ID", settings.GOOGLE_CLIENT_ID),
        ("GOOGLE_CLIENT_SECRET", settings.GOOGLE_CLIENT_SECRET),
    ]
    
    missing_required = []
    missing_optional = []
    recommendations = []
    
    # Check required keys
    for key_name, value in required_keys:
        if not value or value.strip() == "":
            missing_required.append(key_name)
    
    # Check optional keys
    for key_name, value in optional_keys:
        if not value or value.strip() == "":
            missing_optional.append(key_name)
    
    # Generate recommendations
    if missing_required:
        recommendations.append("❌ Missing critical API keys - some features will not work")
    
    if "ENCRYPTION_KEY" in missing_optional:
        recommendations.append("🔐 Generate ENCRYPTION_KEY for secure user data storage")
        recommendations.append("   Run: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
    
    if "PERPLEXITY_API_KEY" in missing_optional:
        recommendations.append("🔍 Add PERPLEXITY_API_KEY for web search functionality")
        recommendations.append("   Get free key at: https://www.perplexity.ai/settings/api")
    
    if "OPENWEATHER_API_KEY" in missing_optional:
        recommendations.append("🌤️  Add OPENWEATHER_API_KEY for weather information")
        recommendations.append("   Get free key at: https://openweathermap.org/api")
    
    if "GOOGLE_CLIENT_ID" in missing_optional or "GOOGLE_CLIENT_SECRET" in missing_optional:
        recommendations.append("📧 Add Google OAuth credentials for Calendar/Gmail integration")
        recommendations.append("   Setup at: https://console.cloud.google.com/apis/credentials")
    
    # Validate URLs and formats
    if settings.SUPABASE_URL and not settings.SUPABASE_URL.startswith("https://"):
        recommendations.append("⚠️  SUPABASE_URL should start with https://")
    
    if settings.LIVEKIT_WS_URL and not settings.LIVEKIT_WS_URL.startswith("wss://"):
        recommendations.append("⚠️  LIVEKIT_WS_URL should start with wss://")
    
    is_valid = len(missing_required) == 0
    
    return ValidationResult(
        is_valid=is_valid,
        missing_keys=missing_required,
        optional_missing=missing_optional,
        recommendations=recommendations
    )

def log_environment_status():
    """Log environment validation status at startup"""
    result = validate_environment()
    
    if result.is_valid:
        logger.info("✅ Environment validation passed - all required keys present")
    else:
        logger.error("❌ Environment validation failed")
        logger.error(f"Missing required keys: {result.missing_keys}")
    
    if result.optional_missing:
        logger.warning(f"Optional keys missing: {result.optional_missing}")
    
    for rec in result.recommendations:
        logger.info(rec)
    
    return result