"""
Google Calendar integration tools
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

class GoogleCalendarTools:
    def __init__(self):
        self.credentials = None
        self.service = None
        self.scopes = ['https://www.googleapis.com/auth/calendar']
        
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate with Google Calendar API using stored OAuth tokens"""
        try:
            from .supabase_client import supabase_client
            from .encryption import encryption_manager
            
            # Get encrypted OAuth token from database (same as Gmail)
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
            
            # Build Calendar service
            self.service = build('calendar', 'v3', credentials=self.credentials)
            logger.info(f"Calendar authentication successful for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Calendar authentication failed: {e}")
            return False
    
    async def add_event(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Add an event to Google Calendar"""
        try:
            # Authenticate first
            if not await self.authenticate(user_id):
                return "Error: Google Calendar authentication failed. Please reconnect your Google account."
            
            # Extract parameters
            title = parameters.get('title')
            start_time = parameters.get('start_time')
            end_time = parameters.get('end_time')
            description = parameters.get('description', '')
            attendees = parameters.get('attendees', [])
            
            # Validate required parameters
            if not all([title, start_time, end_time]):
                return "Error: Missing required parameters (title, start_time, end_time)"
            
            # Parse datetime strings
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            except ValueError as e:
                return f"Error: Invalid datetime format. Use ISO format. {e}"
            
            # Create event object
            event = {
                'summary': title,
                'description': description,
                'start': {
                    'dateTime': start_dt.isoformat(),
                    'timeZone': 'UTC',
                },
                'end': {
                    'dateTime': end_dt.isoformat(),
                    'timeZone': 'UTC',
                },
            }
            
            # Add attendees if provided
            if attendees:
                event['attendees'] = [{'email': email} for email in attendees]
            
            # Create the event via Calendar API
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event
            ).execute()
            
            event_link = created_event.get('htmlLink', '')
            logger.info(f"Calendar event created: {created_event['id']}")
            
            result = f"✅ Calendar event '{title}' scheduled for {start_dt.strftime('%Y-%m-%d %H:%M')} - {end_dt.strftime('%H:%M')} UTC"
            if event_link:
                result += f"\nEvent link: {event_link}"
            
            return result
            
        except HttpError as e:
            error_detail = str(e)
            logger.error(f"Calendar API error: {error_detail}")
            return f"Error creating calendar event: {error_detail}"
        except Exception as e:
            logger.error(f"Error creating calendar event: {e}")
            return f"Error creating calendar event: {str(e)}"
    
    async def get_events(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Get calendar events for a date range"""
        try:
            # Authenticate first
            if not await self.authenticate(user_id):
                return "Error: Google Calendar authentication failed. Please reconnect your Google account."
            
            start_date = parameters.get('start_date')
            end_date = parameters.get('end_date')
            calendar_id = parameters.get('calendar_id', 'primary')
            
            if not all([start_date, end_date]):
                return "Error: Missing required parameters (start_date, end_date)"
            
            # Parse date strings
            try:
                start_dt = datetime.fromisoformat(start_date)
                end_dt = datetime.fromisoformat(end_date)
            except ValueError as e:
                return f"Error: Invalid date format. Use ISO format. {e}"
            
            # Get events from Calendar API
            events_result = self.service.events().list(
                calendarId=calendar_id,
                timeMin=start_dt.isoformat() + 'Z',
                timeMax=end_dt.isoformat() + 'Z',
                maxResults=50,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            if not events:
                return f"📅 No calendar events found from {start_date} to {end_date}"
            
            result = f"📅 Calendar events from {start_date} to {end_date}:\n\n"
            for event in events:
                summary = event.get('summary', 'No Title')
                start = event.get('start', {})
                end = event.get('end', {})
                
                # Handle all-day events
                start_time = start.get('dateTime', start.get('date', ''))
                end_time = end.get('dateTime', end.get('date', ''))
                
                # Format time display
                if 'T' in start_time:  # DateTime event
                    start_formatted = datetime.fromisoformat(start_time.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
                    end_formatted = datetime.fromisoformat(end_time.replace('Z', '+00:00')).strftime('%H:%M')
                    time_str = f"{start_formatted} - {end_formatted}"
                else:  # All-day event
                    time_str = f"{start_time} (All day)"
                
                location = event.get('location', '')
                description = event.get('description', '')
                
                result += f"• **{summary}**\n"
                result += f"  Time: {time_str}\n"
                if location:
                    result += f"  Location: {location}\n"
                if description:
                    result += f"  Description: {description[:100]}{'...' if len(description) > 100 else ''}\n"
                result += "\n"
            
            return result
            
        except HttpError as e:
            error_detail = str(e)
            logger.error(f"Calendar API error: {error_detail}")
            return f"Error fetching calendar events: {error_detail}"
        except Exception as e:
            logger.error(f"Error fetching calendar events: {e}")
            return f"Error fetching calendar events: {str(e)}"

# Global instance
calendar_tools = GoogleCalendarTools()