"""
Google OAuth and API integration for Calendar, Gmail, Keep, and Search
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import httpx
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleAuthManager:
    """Manages Google OAuth flow and API access"""
    
    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/keep',
        'https://www.googleapis.com/auth/customsearch',
        'openid',
        'email',
        'profile'
    ]
    
    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
        
        if not self.client_id or not self.client_secret:
            logger.warning("⚠️  Google OAuth credentials not configured")
    
    def get_auth_url(self, user_id: str) -> Optional[str]:
        """Generate OAuth authorization URL"""
        if not self.client_id or not self.client_secret:
            return None
        
        try:
            client_config = {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            }
            
            flow = Flow.from_client_config(
                client_config,
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            
            flow.state = user_id  # Store user ID in state
            
            auth_url, _ = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true'
            )
            
            return auth_url
            
        except Exception as e:
            logger.error(f"Failed to generate auth URL: {e}")
            return None
    
    async def exchange_code_for_tokens(self, code: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access tokens"""
        if not self.client_id or not self.client_secret:
            return None
        
        try:
            client_config = {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            }
            
            flow = Flow.from_client_config(
                client_config,
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            
            flow.fetch_token(code=code)
            
            credentials = flow.credentials
            
            # Return token info
            token_data = {
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expires_at": credentials.expiry.isoformat() if credentials.expiry else None
            }
            
            return token_data
            
        except Exception as e:
            logger.error(f"Failed to exchange code for tokens: {e}")
            return None
    
    def credentials_from_token_data(self, token_data: Dict[str, Any]) -> Optional[Credentials]:
        """Create credentials object from stored token data"""
        try:
            expiry = None
            if token_data.get("expires_at"):
                expiry = datetime.fromisoformat(token_data["expires_at"].replace('Z', '+00:00'))
            
            credentials = Credentials(
                token=token_data.get("access_token"),
                refresh_token=token_data.get("refresh_token"),
                token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=token_data.get("client_id") or self.client_id,
                client_secret=token_data.get("client_secret") or self.client_secret,
                scopes=token_data.get("scopes", self.SCOPES),
                expiry=expiry
            )
            
            # Refresh if expired
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
            
            return credentials
            
        except Exception as e:
            logger.error(f"Failed to create credentials: {e}")
            return None
    
    async def get_calendar_service(self, token_data: Dict[str, Any]):
        """Get authenticated Calendar service"""
        credentials = self.credentials_from_token_data(token_data)
        if not credentials:
            raise Exception("Invalid Google credentials")
        
        return build('calendar', 'v3', credentials=credentials)
    
    async def get_gmail_service(self, token_data: Dict[str, Any]):
        """Get authenticated Gmail service"""
        credentials = self.credentials_from_token_data(token_data)
        if not credentials:
            raise Exception("Invalid Google credentials")
        
        return build('gmail', 'v1', credentials=credentials)
    
    async def get_customsearch_service(self, token_data: Dict[str, Any]):
        """Get authenticated Custom Search service"""
        credentials = self.credentials_from_token_data(token_data)
        if not credentials:
            raise Exception("Invalid Google credentials")
        
        return build('customsearch', 'v1', credentials=credentials)

# Global instance
google_auth = GoogleAuthManager()