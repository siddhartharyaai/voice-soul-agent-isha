"""
Configuration management and environment validation with Supabase secrets integration
"""

import os
import asyncio
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

# Import Supabase secrets client
try:
    from supabase_secrets import secrets_client
except ImportError:
    logger.warning("Supabase secrets client not available, using environment variables only")
    secrets_client = None

@dataclass
class ValidationResult:
    is_valid: bool
    missing_keys: List[str]
    optional_missing: List[str]
    recommendations: List[str]

class Settings:
    """Application settings with environment validation and Supabase secrets integration"""
    
    def __init__(self):
        # Core FastAPI settings
        self.DEBUG = os.getenv("DEBUG", "false").lower() == "true"
        self.HOST = os.getenv("HOST", "0.0.0.0")
        self.PORT = int(os.getenv("PORT", "8000"))
        
        # Supabase configuration (static values)
        self.SUPABASE_URL = os.getenv("SUPABASE_URL", "https://nlxpyaeufqabcyimlohn.supabase.co")
        self.SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seHB5YWV1ZnFhYmN5aW1sb2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY4NzAsImV4cCI6MjA2ODI3Mjg3MH0.w57pURCdwaMeJycaQdVkQ--2KnbC8cxeB3yA6KMUbag")
        self.SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        # Try to load from Supabase secrets first
        self._load_from_supabase_sync()
        
        # Core AI services (will be loaded from Supabase secrets)
        self.GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        self.DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
        
        # LiveKit configuration (will be loaded from Supabase secrets)
        self.LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
        self.LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
        self.LIVEKIT_WS_URL = os.getenv("LIVEKIT_WS_URL")
        
        # Security
        self.ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
        self.JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
        
        # Optional third-party APIs
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")  # Fallback LLM
        self.PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
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

    def _load_from_supabase_sync(self):
        """Synchronously try to load secrets from Supabase (best effort)"""
        try:
            import requests
            
            # Try with service role key if available
            service_role_key = self.SUPABASE_SERVICE_ROLE_KEY
            if not service_role_key:
                logger.info("🔑 No service role key found, using provided secrets")
                return False
            
            headers = {
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json"
            }
            
            # Try to get secrets
            secrets_to_fetch = [
                "GEMINI_API_KEY", "DEEPGRAM_API_KEY", "LIVEKIT_API_KEY", 
                "LIVEKIT_API_SECRET", "LIVEKIT_WS_URL"
            ]
            
            for secret_name in secrets_to_fetch:
                try:
                    response = requests.post(
                        f"{self.SUPABASE_URL}/functions/v1/get-secret",
                        headers=headers,
                        json={"secret_name": secret_name},
                        timeout=5
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        secret_value = data.get("value")
                        if secret_value:
                            setattr(self, secret_name, secret_value)
                            os.environ[secret_name] = secret_value
                            logger.info(f"✅ Loaded {secret_name} from Supabase")
                except Exception as e:
                    logger.debug(f"Could not load {secret_name}: {e}")
                    
            return True
            
        except Exception as e:
            logger.debug(f"Supabase secrets loading failed (will use env vars): {e}")
            return False

    async def load_secrets_from_supabase(self):
        """Load secrets from Supabase and update settings"""
        if secrets_client:
            try:
                logger.info("🔑 Loading secrets from Supabase...")
                secrets = await secrets_client.load_all_secrets()
                
                # Update settings with loaded secrets
                for key, value in secrets.items():
                    setattr(self, key, value)
                    logger.info(f"✅ Loaded secret: {key}")
                
                logger.info(f"🎉 Successfully loaded {len(secrets)} secrets from Supabase")
                return True
            except Exception as e:
                logger.error(f"❌ Failed to load secrets from Supabase: {e}")
                return False
        else:
            logger.warning("⚠️ Supabase secrets client not available")
            return False

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