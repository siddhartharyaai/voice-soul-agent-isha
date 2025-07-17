"""
Additional tool integrations: Notion, Slack, Todoist, GitHub, Spotify, News
"""

import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import httpx
from .supabase_client import get_user_api_key, get_user_tokens

logger = logging.getLogger(__name__)

class NotionTools:
    """Notion API integration"""
    
    def __init__(self):
        self.client_id = os.getenv("NOTION_CLIENT_ID")
        self.client_secret = os.getenv("NOTION_CLIENT_SECRET")
    
    async def search_pages(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Search Notion pages"""
        try:
            # Get user's Notion token
            tokens = await get_user_tokens(user_id, "notion")
            if not tokens or not tokens.get("access_token"):
                return "❌ Notion not connected. Please authenticate first."
            
            query = parameters.get('query', '')
            
            headers = {
                "Authorization": f"Bearer {tokens['access_token']}",
                "Notion-Version": "2022-06-28",
                "Content-Type": "application/json"
            }
            
            payload = {
                "query": query,
                "sort": {
                    "direction": "descending",
                    "timestamp": "last_edited_time"
                }
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.notion.com/v1/search",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    
                    if not results:
                        return f"📄 No Notion pages found for query: {query}"
                    
                    formatted_results = []
                    for page in results[:10]:  # Limit to 10 results
                        title = "Untitled"
                        if page.get("properties", {}).get("title"):
                            title_prop = page["properties"]["title"]
                            if title_prop.get("title") and len(title_prop["title"]) > 0:
                                title = title_prop["title"][0]["plain_text"]
                        
                        url = page.get("url", "")
                        last_edited = page.get("last_edited_time", "")
                        
                        result_str = f"📄 **{title}**\n🔗 {url}\n📅 Last edited: {last_edited[:10]}\n"
                        formatted_results.append(result_str)
                    
                    return f"📄 Found {len(results)} Notion pages:\n\n" + "\n".join(formatted_results)
                else:
                    return f"❌ Notion API error ({response.status_code}): {response.text}"
                    
        except Exception as e:
            logger.error(f"Error searching Notion pages: {e}")
            return f"❌ Failed to search Notion: {str(e)}"


class SlackTools:
    """Slack API integration"""
    
    def __init__(self):
        self.bot_token = os.getenv("SLACK_BOT_TOKEN")
    
    async def send_message(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Send Slack message"""
        try:
            # Get user's Slack token or use bot token
            api_key = await get_user_api_key(user_id, "slack") or self.bot_token
            if not api_key:
                return "❌ Slack not configured. Please add your bot token in settings."
            
            channel = parameters.get('channel')
            text = parameters.get('text')
            
            if not channel or not text:
                return "❌ Channel and text are required for Slack message"
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "channel": channel,
                "text": text
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://slack.com/api/chat.postMessage",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        return f"✅ Slack message sent to {channel}"
                    else:
                        return f"❌ Slack error: {data.get('error', 'Unknown error')}"
                else:
                    return f"❌ Slack API error ({response.status_code}): {response.text}"
                    
        except Exception as e:
            logger.error(f"Error sending Slack message: {e}")
            return f"❌ Failed to send Slack message: {str(e)}"


class TodoistTools:
    """Todoist API integration"""
    
    def __init__(self):
        self.api_token = os.getenv("TODOIST_API_TOKEN")
    
    async def add_task(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Add task to Todoist"""
        try:
            api_key = await get_user_api_key(user_id, "todoist") or self.api_token
            if not api_key:
                return "❌ Todoist not configured. Please add your API token in settings."
            
            content = parameters.get('content')
            if not content:
                return "❌ Task content is required"
            
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "content": content,
                "project_id": parameters.get('project_id'),
                "due_string": parameters.get('due_date'),
                "priority": parameters.get('priority', 1)
            }
            
            # Remove None values
            payload = {k: v for k, v in payload.items() if v is not None}
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.todoist.com/rest/v2/tasks",
                    headers=headers,
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    task_url = data.get("url", "")
                    return f"✅ Todoist task created: {content}\n🔗 {task_url}"
                else:
                    return f"❌ Todoist API error ({response.status_code}): {response.text}"
                    
        except Exception as e:
            logger.error(f"Error adding Todoist task: {e}")
            return f"❌ Failed to add Todoist task: {str(e)}"


class GitHubTools:
    """GitHub API integration"""
    
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN")
    
    async def search_repositories(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Search GitHub repositories"""
        try:
            api_key = await get_user_api_key(user_id, "github") or self.token
            if not api_key:
                return "❌ GitHub not configured. Please add your personal access token in settings."
            
            query = parameters.get('query')
            if not query:
                return "❌ Search query is required"
            
            headers = {
                "Authorization": f"token {api_key}",
                "Accept": "application/vnd.github.v3+json"
            }
            
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": min(parameters.get('limit', 10), 20)
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.github.com/search/repositories",
                    headers=headers,
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    repos = data.get("items", [])
                    
                    if not repos:
                        return f"🔍 No GitHub repositories found for query: {query}"
                    
                    formatted_repos = []
                    for repo in repos:
                        name = repo.get("full_name", "Unknown")
                        description = repo.get("description", "No description")
                        stars = repo.get("stargazers_count", 0)
                        language = repo.get("language", "Unknown")
                        url = repo.get("html_url", "")
                        
                        repo_str = f"⭐ **{name}** ({stars:,} stars)\n🔗 {url}\n💻 {language}\n📝 {description}\n"
                        formatted_repos.append(repo_str)
                    
                    return f"🔍 Found {len(repos)} GitHub repositories:\n\n" + "\n".join(formatted_repos)
                else:
                    return f"❌ GitHub API error ({response.status_code}): {response.text}"
                    
        except Exception as e:
            logger.error(f"Error searching GitHub repositories: {e}")
            return f"❌ Failed to search GitHub: {str(e)}"


class NewsTools:
    """News API integration"""
    
    def __init__(self):
        self.api_key = os.getenv("NEWS_API_KEY")
    
    async def get_top_headlines(self, parameters: Dict[str, Any], user_id: str) -> str:
        """Get top news headlines"""
        try:
            api_key = await get_user_api_key(user_id, "newsapi") or self.api_key
            if not api_key:
                return "❌ News API not configured. Please add your API key in settings.\n🔗 Get free key at: https://newsapi.org/"
            
            category = parameters.get('category', 'general')
            country = parameters.get('country', 'us')
            page_size = min(parameters.get('limit', 10), 20)
            
            params = {
                "apiKey": api_key,
                "category": category,
                "country": country,
                "pageSize": page_size
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://newsapi.org/v2/top-headlines",
                    params=params
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data.get("status") != "ok":
                        return f"❌ News API error: {data.get('message', 'Unknown error')}"
                    
                    articles = data.get("articles", [])
                    
                    if not articles:
                        return f"📰 No news articles found for category: {category}"
                    
                    formatted_articles = []
                    for article in articles:
                        title = article.get("title", "No title")
                        description = article.get("description", "No description")
                        source = article.get("source", {}).get("name", "Unknown source")
                        url = article.get("url", "")
                        published_at = article.get("publishedAt", "")
                        
                        # Format date
                        try:
                            if published_at:
                                dt = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                                published_at = dt.strftime('%Y-%m-%d %H:%M')
                        except:
                            pass
                        
                        article_str = f"📰 **{title}**\n🏢 {source} • {published_at}\n📝 {description}\n🔗 {url}\n"
                        formatted_articles.append(article_str)
                    
                    return f"📰 Top Headlines ({category}):\n\n" + "\n".join(formatted_articles)
                else:
                    return f"❌ News API error ({response.status_code}): {response.text}"
                    
        except Exception as e:
            logger.error(f"Error getting news headlines: {e}")
            return f"❌ Failed to get news: {str(e)}"


# Global instances
notion_tools = NotionTools()
slack_tools = SlackTools()
todoist_tools = TodoistTools()
github_tools = GitHubTools()
news_tools = NewsTools()