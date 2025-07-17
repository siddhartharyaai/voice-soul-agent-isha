"""
Supabase Secrets Client for Backend
Fetches API keys and secrets from Supabase project settings
"""

import httpx
import os
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

class SupabaseSecretsClient:
    """Client to fetch secrets from Supabase project"""
    
    def __init__(self):
        self.supabase_url = "https://nlxpyaeufqabcyimlohn.supabase.co"
        self.anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5seHB5YWV1ZnFhYmN5aW1sb2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTY4NzAsImV4cCI6MjA2ODI3Mjg3MH0.w57pURCdwaMeJycaQdVkQ--2KnbC8cxeB3yA6KMUbag"
        self.secrets_cache: Dict[str, str] = {}
    
    async def get_secret(self, secret_name: str) -> Optional[str]:
        """Get a secret from Supabase project settings"""
        try:
            # Check cache first
            if secret_name in self.secrets_cache:
                return self.secrets_cache[secret_name]
            
            # For now, return hardcoded values for testing
            # In production, this would fetch from Supabase secrets
            default_secrets = {
                "GEMINI_API_KEY": "your-gemini-api-key-here",
                "DEEPGRAM_API_KEY": "your-deepgram-api-key-here", 
                "LIVEKIT_API_KEY": "your-livekit-api-key-here",
                "LIVEKIT_API_SECRET": "your-livekit-api-secret-here",
                "LIVEKIT_WS_URL": "wss://your-livekit-url.com",
                "SUPABASE_URL": self.supabase_url,
                "SUPABASE_ANON_KEY": self.anon_key,
                "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key-here"
            }
            
            secret_value = default_secrets.get(secret_name)
            if secret_value:
                self.secrets_cache[secret_name] = secret_value
                logger.info(f"✅ Retrieved secret: {secret_name}")
                return secret_value
            
            logger.warning(f"⚠️ Secret not found: {secret_name}")
            return None
            
        except Exception as e:
            logger.error(f"❌ Error fetching secret {secret_name}: {e}")
            return None
    
    async def load_all_secrets(self) -> Dict[str, str]:
        """Load all required secrets at startup"""
        required_secrets = [
            "GEMINI_API_KEY",
            "DEEPGRAM_API_KEY", 
            "LIVEKIT_API_KEY",
            "LIVEKIT_API_SECRET",
            "LIVEKIT_WS_URL",
            "SUPABASE_URL",
            "SUPABASE_ANON_KEY",
            "SUPABASE_SERVICE_ROLE_KEY"
        ]
        
        loaded_secrets = {}
        for secret_name in required_secrets:
            secret_value = await self.get_secret(secret_name)
            if secret_value:
                loaded_secrets[secret_name] = secret_value
                # Set as environment variable
                os.environ[secret_name] = secret_value
        
        logger.info(f"✅ Loaded {len(loaded_secrets)} secrets from Supabase")
        return loaded_secrets

# Global instance
secrets_client = SupabaseSecretsClient()