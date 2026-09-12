import os
import logging
import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
TAVILY_URL = "https://api.tavily.com/search"

def tool_web_search(query: str, limit: int = 5):
    try:
        payload = {
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": "basic",
            "max_results": limit
        }

        response = requests.post(TAVILY_URL, json=payload, timeout=10)

        if response.status_code != 200:
            logger.error(f"Tavily error {response.status_code}: {response.text}")
            return ""

        data = response.json()
        results = data.get("results", [])

        lines = []
        for r in results:
            title = r.get("title", "")
            url = r.get("url", "")
            snippet = r.get("content", "")

            lines.append(f"- {title}\n  {snippet}\n  {url}")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error Tavily search: {e}")
        return ""
