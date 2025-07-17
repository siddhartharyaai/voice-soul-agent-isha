"""
Supabase client for storing user tokens and API keys securely
"""

import os
import logging
from typing import Dict, Any, Optional, List
import httpx
from .encryption import encryption_manager

logger = logging.getLogger(__name__)

class SupabaseClient:
    """Client for interacting with Supabase"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.anon_key = os.getenv("SUPABASE_ANON_KEY")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.anon_key:
            logger.warning("⚠️  Supabase configuration not complete")
    
    def _get_headers(self, use_service_role: bool = False) -> Dict[str, str]:
        """Get headers for Supabase requests"""
        key = self.service_role_key if use_service_role and self.service_role_key else self.anon_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    
    async def save_user_tokens(self, user_id: str, service: str, tokens: Dict[str, Any]) -> bool:
        """Save encrypted user tokens to Supabase"""
        try:
            if not self.url or not self.anon_key:
                logger.error("Supabase not configured")
                return False
            
            # Encrypt sensitive data
            encrypted_tokens = encryption_manager.encrypt_dict(tokens)
            
            # Prepare data
            data = {
                "user_id": user_id,
                "service": service,
                "tokens": encrypted_tokens,
                "updated_at": "now()"
            }
            
            async with httpx.AsyncClient() as client:
                # Try to update existing record first
                response = await client.patch(
                    f"{self.url}/rest/v1/user_tokens",
                    headers=self._get_headers(use_service_role=True),
                    params={"user_id": f"eq.{user_id}", "service": f"eq.{service}"},
                    json=data
                )
                
                if response.status_code == 200:
                    return True
                
                # If no existing record, create new one
                response = await client.post(
                    f"{self.url}/rest/v1/user_tokens",
                    headers=self._get_headers(use_service_role=True),
                    json=data
                )
                
                return response.status_code in [200, 201]
                
        except Exception as e:
            logger.error(f"Error saving user tokens: {e}")
            return False
    
    async def get_user_tokens(self, user_id: str, service: str) -> Optional[Dict[str, Any]]:
        """Get and decrypt user tokens from Supabase"""
        try:
            if not self.url or not self.anon_key:
                logger.error("Supabase not configured")
                return None
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/user_tokens",
                    headers=self._get_headers(use_service_role=True),
                    params={"user_id": f"eq.{user_id}", "service": f"eq.{service}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data and len(data) > 0:
                        tokens = data[0].get("tokens", {})
                        # Decrypt sensitive data
                        return encryption_manager.decrypt_dict(tokens)
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting user tokens: {e}")
            return None
    
    async def save_user_api_key(self, user_id: str, service: str, api_key: str) -> bool:
        """Save encrypted user API key"""
        try:
            encrypted_key = encryption_manager.encrypt(api_key)
            if not encrypted_key:
                logger.error("Failed to encrypt API key")
                return False
            
            data = {
                "user_id": user_id,
                "service": service,
                "api_key": encrypted_key,
                "updated_at": "now()"
            }
            
            async with httpx.AsyncClient() as client:
                # Try to update existing record first
                response = await client.patch(
                    f"{self.url}/rest/v1/user_api_keys",
                    headers=self._get_headers(use_service_role=True),
                    params={"user_id": f"eq.{user_id}", "service": f"eq.{service}"},
                    json=data
                )
                
                if response.status_code == 200:
                    return True
                
                # If no existing record, create new one
                response = await client.post(
                    f"{self.url}/rest/v1/user_api_keys",
                    headers=self._get_headers(use_service_role=True),
                    json=data
                )
                
                return response.status_code in [200, 201]
                
        except Exception as e:
            logger.error(f"Error saving user API key: {e}")
            return False
    
    async def get_user_api_key(self, user_id: str, service: str) -> Optional[str]:
        """Get and decrypt user API key"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/user_api_keys",
                    headers=self._get_headers(use_service_role=True),
                    params={"user_id": f"eq.{user_id}", "service": f"eq.{service}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data and len(data) > 0:
                        encrypted_key = data[0].get("api_key")
                        if encrypted_key:
                            return encryption_manager.decrypt(encrypted_key)
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting user API key: {e}")
            return None
    
    async def get_user_mcp_servers(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's MCP servers"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/mcp_servers",
                    headers=self._get_headers(),
                    params={"user_id": f"eq.{user_id}"}
                )
                
                if response.status_code == 200:
                    servers = response.json()
                    # Decrypt API keys
                    for server in servers:
                        if server.get("api_key"):
                            decrypted_key = encryption_manager.decrypt(server["api_key"])
                            server["api_key"] = decrypted_key
                    return servers
                
                return []
                
        except Exception as e:
            logger.error(f"Error getting user MCP servers: {e}")
            return []

# Global instance
supabase_client = SupabaseClient()

# Convenience functions
async def get_user_tokens(user_id: str, service: str) -> Optional[Dict[str, Any]]:
    return await supabase_client.get_user_tokens(user_id, service)

async def save_user_tokens(user_id: str, service: str, tokens: Dict[str, Any]) -> bool:
    return await supabase_client.save_user_tokens(user_id, service, tokens)

async def get_user_api_key(user_id: str, service: str) -> Optional[str]:
    return await supabase_client.get_user_api_key(user_id, service)

async def save_user_api_key(user_id: str, service: str, api_key: str) -> bool:
    return await supabase_client.save_user_api_key(user_id, service, api_key)