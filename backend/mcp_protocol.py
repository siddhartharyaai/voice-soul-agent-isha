"""
MCP (Model Context Protocol) implementation for secure tool integration
Handles communication with various MCP servers and tool execution
"""

import json
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import httpx
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

class MCPToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]
    call_id: Optional[str] = None

class MCPToolResult(BaseModel):
    call_id: Optional[str] = None
    result: Union[str, Dict[str, Any]]
    error: Optional[str] = None
    requires_approval: bool = False

class MCPServer(BaseModel):
    name: str
    url: str
    api_key: Optional[str] = None
    enabled: bool = True
    approval_mode: str = "always_ask"  # "always_ask", "auto_approve", "never"
    description: Optional[str] = None
    tools: List[Dict[str, Any]] = []
    last_sync: Optional[datetime] = None

class MCPProtocolHandler:
    """Handles MCP protocol communication and tool execution"""
    
    def __init__(self):
        self.servers: Dict[str, MCPServer] = {}
        self.pending_approvals: Dict[str, MCPToolCall] = {}
        self.tool_registry: Dict[str, str] = {}  # tool_name -> server_name
        
        # Initialize default MCP servers
        self._initialize_default_servers()
    
    def _initialize_default_servers(self):
        """Initialize built-in MCP servers"""
        
        # Google Calendar MCP Server
        calendar_server = MCPServer(
            name="google_calendar",
            url="builtin://calendar",
            description="Google Calendar integration for managing events",
            tools=[
                {
                    "name": "add_calendar_event",
                    "description": "Add an event to Google Calendar",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "Event title"},
                            "start_time": {"type": "string", "description": "Start time (ISO format)"},
                            "end_time": {"type": "string", "description": "End time (ISO format)"},
                            "description": {"type": "string", "description": "Event description"},
                            "attendees": {"type": "array", "items": {"type": "string"}, "description": "Attendee emails"}
                        },
                        "required": ["title", "start_time", "end_time"]
                    }
                },
                {
                    "name": "get_calendar_events",
                    "description": "Get calendar events for a date range",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "start_date": {"type": "string", "description": "Start date (ISO format)"},
                            "end_date": {"type": "string", "description": "End date (ISO format)"},
                            "calendar_id": {"type": "string", "description": "Calendar ID (optional)"}
                        },
                        "required": ["start_date", "end_date"]
                    }
                }
            ]
        )
        
        # Gmail MCP Server
        gmail_server = MCPServer(
            name="gmail",
            url="builtin://gmail",
            description="Gmail integration for email management",
            tools=[
                {
                    "name": "send_email",
                    "description": "Send an email via Gmail",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "to": {"type": "string", "description": "Recipient email"},
                            "subject": {"type": "string", "description": "Email subject"},
                            "body": {"type": "string", "description": "Email body"},
                            "cc": {"type": "string", "description": "CC recipients"},
                            "attachments": {"type": "array", "items": {"type": "string"}, "description": "File paths"}
                        },
                        "required": ["to", "subject", "body"]
                    }
                },
                {
                    "name": "read_emails",
                    "description": "Read recent emails from Gmail",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Gmail search query"},
                            "max_results": {"type": "integer", "description": "Maximum number of emails to return", "default": 10}
                        }
                    }
                }
            ]
        )
        
        # Perplexity Search MCP Server
        perplexity_server = MCPServer(
            name="perplexity_search",
            url="builtin://perplexity",
            description="Web search using Perplexity AI",
            tools=[
                {
                    "name": "search_web",
                    "description": "Search the web using Perplexity AI",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Search query"},
                            "focus": {"type": "string", "enum": ["internet", "academic", "writing", "wolfram", "youtube", "reddit"], "description": "Search focus"}
                        },
                        "required": ["query"]
                    }
                }
            ]
        )
        
        # Weather MCP Server
        weather_server = MCPServer(
            name="openweather",
            url="builtin://weather",
            description="Weather information using OpenWeatherMap",
            tools=[
                {
                    "name": "get_weather",
                    "description": "Get current weather for a location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "City name or coordinates"},
                            "units": {"type": "string", "enum": ["metric", "imperial", "kelvin"], "default": "metric"}
                        },
                        "required": ["location"]
                    }
                },
                {
                    "name": "get_weather_forecast",
                    "description": "Get weather forecast for a location",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {"type": "string", "description": "City name or coordinates"},
                            "days": {"type": "integer", "description": "Number of days", "default": 5},
                            "units": {"type": "string", "enum": ["metric", "imperial", "kelvin"], "default": "metric"}
                        },
                        "required": ["location"]
                    }
                }
            ]
        )
        
        # Register default servers
        self.servers["google_calendar"] = calendar_server
        self.servers["gmail"] = gmail_server
        self.servers["perplexity_search"] = perplexity_server
        self.servers["openweather"] = weather_server
        
        # Build tool registry
        self._rebuild_tool_registry()
    
    async def add_custom_server(self, server_config: Dict[str, Any]) -> bool:
        """Add a custom MCP server"""
        try:
            server = MCPServer(**server_config)
            
            # Test connection and fetch tools
            if server.url.startswith("http"):
                tools = await self._fetch_server_tools(server)
                server.tools = tools
                server.last_sync = datetime.now()
            
            self.servers[server.name] = server
            self._rebuild_tool_registry()
            
            logger.info(f"Added MCP server: {server.name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add MCP server: {e}")
            return False
    
    async def _fetch_server_tools(self, server: MCPServer) -> List[Dict[str, Any]]:
        """Fetch available tools from an MCP server"""
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Content-Type": "application/json"}
                if server.api_key:
                    headers["Authorization"] = f"Bearer {server.api_key}"
                
                response = await client.get(f"{server.url}/tools", headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    return data.get("tools", [])
                else:
                    logger.warning(f"Failed to fetch tools from {server.name}: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error fetching tools from {server.name}: {e}")
            return []
    
    def _rebuild_tool_registry(self):
        """Rebuild the tool name to server mapping"""
        self.tool_registry.clear()
        
        for server_name, server in self.servers.items():
            if server.enabled:
                for tool in server.tools:
                    tool_name = tool.get("name")
                    if tool_name:
                        self.tool_registry[tool_name] = server_name
    
    def get_available_tools(self) -> List[Dict[str, Any]]:
        """Get all available tools from enabled servers"""
        tools = []
        
        for server in self.servers.values():
            if server.enabled:
                tools.extend(server.tools)
        
        return tools
    
    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        user_id: str,
        requires_approval: bool = None
    ) -> MCPToolResult:
        """Execute a tool call through the appropriate MCP server"""
        
        if tool_name not in self.tool_registry:
            return MCPToolResult(
                result="",
                error=f"Tool '{tool_name}' not found in any registered MCP server"
            )
        
        server_name = self.tool_registry[tool_name]
        server = self.servers[server_name]
        
        # Check approval requirements
        if requires_approval is None:
            requires_approval = server.approval_mode == "always_ask"
        
        if requires_approval:
            # Store for approval workflow
            call_id = f"{user_id}_{tool_name}_{datetime.now().timestamp()}"
            tool_call = MCPToolCall(name=tool_name, arguments=arguments, call_id=call_id)
            self.pending_approvals[call_id] = tool_call
            
            return MCPToolResult(
                call_id=call_id,
                result=f"Tool call '{tool_name}' requires approval. Call ID: {call_id}",
                requires_approval=True
            )
        
        # Execute the tool
        try:
            if server.url.startswith("builtin://"):
                return await self._execute_builtin_tool(tool_name, arguments)
            else:
                return await self._execute_external_tool(server, tool_name, arguments)
                
        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return MCPToolResult(
                result="",
                error=f"Failed to execute tool: {str(e)}"
            )
    
    async def approve_tool_call(self, call_id: str) -> MCPToolResult:
        """Approve and execute a pending tool call"""
        if call_id not in self.pending_approvals:
            return MCPToolResult(
                result="",
                error=f"No pending approval found for call ID: {call_id}"
            )
        
        tool_call = self.pending_approvals.pop(call_id)
        
        # Execute the approved tool
        return await self.execute_tool(
            tool_call.name,
            tool_call.arguments,
            user_id="approved",
            requires_approval=False
        )
    
    async def _execute_builtin_tool(self, tool_name: str, arguments: Dict[str, Any]) -> MCPToolResult:
        """Execute built-in tools"""
        
        if tool_name == "add_calendar_event":
            return await self._handle_calendar_event(arguments)
        elif tool_name == "get_calendar_events":
            return await self._handle_get_calendar_events(arguments)
        elif tool_name == "send_email":
            return await self._handle_send_email(arguments)
        elif tool_name == "read_emails":
            return await self._handle_read_emails(arguments)
        elif tool_name == "search_web":
            return await self._handle_perplexity_search(arguments)
        elif tool_name == "get_weather":
            return await self._handle_get_weather(arguments)
        elif tool_name == "get_weather_forecast":
            return await self._handle_get_weather_forecast(arguments)
        else:
            return MCPToolResult(
                result="",
                error=f"Unknown built-in tool: {tool_name}"
            )
    
    async def _execute_external_tool(
        self,
        server: MCPServer,
        tool_name: str,
        arguments: Dict[str, Any]
    ) -> MCPToolResult:
        """Execute tool on external MCP server"""
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Content-Type": "application/json"}
                if server.api_key:
                    headers["Authorization"] = f"Bearer {server.api_key}"
                
                payload = {
                    "tool": tool_name,
                    "arguments": arguments
                }
                
                response = await client.post(
                    f"{server.url}/execute",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return MCPToolResult(
                        result=data.get("result", ""),
                        error=data.get("error")
                    )
                else:
                    return MCPToolResult(
                        result="",
                        error=f"Server returned status {response.status_code}: {response.text}"
                    )
                    
        except Exception as e:
            logger.error(f"Error calling external MCP server {server.name}: {e}")
            return MCPToolResult(
                result="",
                error=f"Failed to communicate with MCP server: {str(e)}"
            )
    
    # Built-in tool handlers (placeholders - need actual API integrations)
    async def _handle_calendar_event(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle Google Calendar event creation"""
        # TODO: Implement actual Google Calendar API integration
        return MCPToolResult(
            result=f"Calendar event '{arguments.get('title')}' would be created from {arguments.get('start_time')} to {arguments.get('end_time')}"
        )
    
    async def _handle_get_calendar_events(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle getting calendar events"""
        # TODO: Implement actual Google Calendar API integration
        return MCPToolResult(
            result=f"Calendar events from {arguments.get('start_date')} to {arguments.get('end_date')} would be retrieved"
        )
    
    async def _handle_send_email(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle Gmail email sending"""
        # TODO: Implement actual Gmail API integration
        return MCPToolResult(
            result=f"Email to {arguments.get('to')} with subject '{arguments.get('subject')}' would be sent"
        )
    
    async def _handle_read_emails(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle reading Gmail emails"""
        # TODO: Implement actual Gmail API integration
        return MCPToolResult(
            result=f"Recent emails with query '{arguments.get('query', 'all')}' would be retrieved"
        )
    
    async def _handle_perplexity_search(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle Perplexity web search"""
        # TODO: Implement actual Perplexity API integration
        return MCPToolResult(
            result=f"Web search results for '{arguments.get('query')}' would be returned"
        )
    
    async def _handle_get_weather(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle OpenWeatherMap current weather"""
        # TODO: Implement actual OpenWeatherMap API integration
        return MCPToolResult(
            result=f"Current weather for {arguments.get('location')} would be retrieved"
        )
    
    async def _handle_get_weather_forecast(self, arguments: Dict[str, Any]) -> MCPToolResult:
        """Handle OpenWeatherMap weather forecast"""
        # TODO: Implement actual OpenWeatherMap API integration
        return MCPToolResult(
            result=f"Weather forecast for {arguments.get('location')} ({arguments.get('days', 5)} days) would be retrieved"
        )

# Global MCP handler instance
mcp_handler = MCPProtocolHandler()