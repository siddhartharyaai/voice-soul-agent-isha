"""
Web search integration tools
"""

import os
import json
from typing import Dict, Any
import logging
import httpx

logger = logging.getLogger(__name__)

class SearchTools:
    def __init__(self):
        self.perplexity_api_key = os.getenv("PERPLEXITY_API_KEY")
        self.google_search_api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
        self.google_search_engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
    
    async def perplexity_search(self, parameters: Dict[str, Any]) -> str:
        """Search the web using Perplexity AI"""
        try:
            query = parameters.get('query')
            focus = parameters.get('focus', 'internet')
            
            if not query:
                return "Error: Missing required parameter 'query'"
            
            if not self.perplexity_api_key:
                return "Error: Perplexity API key not configured"
            
            # Prepare Perplexity API request
            headers = {
                "Authorization": f"Bearer {self.perplexity_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.1-sonar-small-128k-online",
                "messages": [
                    {
                        "role": "system",
                        "content": "Be precise and concise. Provide factual information with sources."
                    },
                    {
                        "role": "user", 
                        "content": query
                    }
                ],
                "temperature": 0.2,
                "top_p": 0.9,
                "max_tokens": 1000,
                "search_domain_filter": ["perplexity.ai"] if focus == "academic" else [],
                "search_recency_filter": "month",
                "return_images": False,
                "return_related_questions": False
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return f"🔍 Web search results for '{query}':\n\n{content}"
                else:
                    logger.error(f"Perplexity API error: {response.status_code} - {response.text}")
                    return f"Error: Perplexity API returned status {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Error in Perplexity search: {e}")
            return f"Error performing web search: {str(e)}"
    
    async def google_search(self, parameters: Dict[str, Any]) -> str:
        """Search using Google Custom Search API"""
        try:
            query = parameters.get('query')
            num_results = parameters.get('num_results', 5)
            
            if not query:
                return "Error: Missing required parameter 'query'"
            
            if not self.google_search_api_key or not self.google_search_engine_id:
                return "Error: Google Search API credentials not configured"
            
            # Prepare Google Search API request
            params = {
                'key': self.google_search_api_key,
                'cx': self.google_search_engine_id,
                'q': query,
                'num': min(num_results, 10)  # Google allows max 10 results per request
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params=params,
                    timeout=15.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    items = data.get('items', [])
                    
                    if not items:
                        return f"No search results found for '{query}'"
                    
                    result = f"🔍 Google search results for '{query}':\n\n"
                    for i, item in enumerate(items, 1):
                        title = item.get('title', 'No title')
                        link = item.get('link', '')
                        snippet = item.get('snippet', 'No description')
                        result += f"{i}. **{title}**\n"
                        result += f"   {snippet}\n"
                        result += f"   🔗 {link}\n\n"
                    
                    return result
                else:
                    logger.error(f"Google Search API error: {response.status_code} - {response.text}")
                    return f"Error: Google Search API returned status {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Error in Google search: {e}")
            return f"Error performing Google search: {str(e)}"

# Global instance
search_tools = SearchTools()