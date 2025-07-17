"""
Gmail integration tools
"""

import os
import base64
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
import logging
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GmailTools:
    def __init__(self):
        self.credentials = None
        self.service = None
        self.scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly'
        ]
        
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate with Gmail API using stored OAuth tokens"""
        try:
            from .supabase_client import supabase_client
            from .encryption import encryption_manager
            
            # Get encrypted OAuth token from database
            response = supabase_client.table('user_api_keys').select('*').eq('user_id', user_id).eq('service', 'google_oauth').execute()
            
            if not response.data:
                logger.warning(f"No Google OAuth token found for user {user_id}")
                return False
            
            # Decrypt token data
            encrypted_data = response.data[0]['encrypted_data']
            token_data = encryption_manager.decrypt(encrypted_data)
            
            if not token_data:
                logger.error("Failed to decrypt Google OAuth token")
                return False
            
            import json
            token_info = json.loads(token_data)
            
            # Create credentials object
            self.credentials = Credentials(
                token=token_info.get('access_token'),
                refresh_token=token_info.get('refresh_token'),
                token_uri=token_info.get('token_uri', 'https://oauth2.googleapis.com/token'),
                client_id=token_info.get('client_id'),
                client_secret=token_info.get('client_secret'),
                scopes=self.scopes
            )
            
            # Refresh if needed
            if self.credentials.expired:
                self.credentials.refresh(Request())
                
                # Update stored token if refreshed
                updated_data = {
                    'access_token': self.credentials.token,
                    'refresh_token': self.credentials.refresh_token,
                    'client_id': token_info.get('client_id'),
                    'client_secret': token_info.get('client_secret'),
                    'token_uri': self.credentials.token_uri
                }
                
                encrypted_updated = encryption_manager.encrypt(json.dumps(updated_data))
                if encrypted_updated:
                    supabase_client.table('user_api_keys').update({
                        'encrypted_data': encrypted_updated
                    }).eq('user_id', user_id).eq('service', 'google_oauth').execute()
            
            # Build Gmail service
            self.service = build('gmail', 'v1', credentials=self.credentials)
            logger.info(f"Gmail authentication successful for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Gmail authentication failed: {e}")
            return False
    
    async def send_email(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Send an email via Gmail"""
        try:
            # Authenticate first
            if not await self.authenticate(user_id):
                return "Error: Gmail authentication failed. Please reconnect your Google account."
            
            to_email = parameters.get('to')
            subject = parameters.get('subject')
            body = parameters.get('body')
            cc_emails = parameters.get('cc', '')
            
            if not all([to_email, subject, body]):
                return "Error: Missing required parameters (to, subject, body)"
            
            # Create email message
            message = MIMEMultipart()
            message['to'] = to_email
            message['subject'] = subject
            
            if cc_emails:
                message['cc'] = cc_emails
            
            # Add body
            message.attach(MIMEText(body, 'plain'))
            
            # Convert to raw format
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            # Send email via Gmail API
            result = self.service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            logger.info(f"Email sent successfully to {to_email}, message ID: {result['id']}")
            return f"✅ Email sent successfully to {to_email}"
            
        except HttpError as e:
            error_detail = str(e)
            logger.error(f"Gmail API error: {error_detail}")
            return f"Error sending email: {error_detail}"
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return f"Error sending email: {str(e)}"
    
    async def read_emails(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Read recent emails from Gmail"""
        try:
            # Authenticate first
            if not await self.authenticate(user_id):
                return "Error: Gmail authentication failed. Please reconnect your Google account."
            
            query = parameters.get('query', 'is:unread')
            max_results = min(parameters.get('max_results', 10), 20)  # Limit to 20
            
            # Get messages list
            result = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()
            
            messages = result.get('messages', [])
            
            if not messages:
                return f"📧 No emails found for query: '{query}'"
            
            email_list = []
            for message in messages:
                # Get message details
                msg = self.service.users().messages().get(
                    userId='me',
                    id=message['id'],
                    format='metadata',
                    metadataHeaders=['From', 'Subject', 'Date']
                ).execute()
                
                # Extract headers
                headers = {h['name']: h['value'] for h in msg['payload'].get('headers', [])}
                
                email_info = {
                    'subject': headers.get('Subject', 'No Subject'),
                    'from': headers.get('From', 'Unknown Sender'),
                    'date': headers.get('Date', ''),
                    'snippet': msg.get('snippet', ''),
                    'id': message['id']
                }
                email_list.append(email_info)
            
            # Format response
            result = f"📧 Recent emails (query: '{query}'):\n\n"
            for i, email in enumerate(email_list, 1):
                result += f"{i}. **{email['subject']}**\n"
                result += f"   From: {email['from']}\n"
                result += f"   Date: {email['date']}\n"
                result += f"   Preview: {email['snippet']}\n\n"
            
            return result
            
        except HttpError as e:
            error_detail = str(e)
            logger.error(f"Gmail API error: {error_detail}")
            return f"Error reading emails: {error_detail}"
        except Exception as e:
            logger.error(f"Error reading emails: {e}")
            return f"Error reading emails: {str(e)}"

# Global instance
gmail_tools = GmailTools()