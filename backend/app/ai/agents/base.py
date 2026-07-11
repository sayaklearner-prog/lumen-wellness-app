from abc import ABC, abstractmethod
from typing import Dict, Any, List, AsyncGenerator
from app.ai.provider import default_provider

class BaseAgent(ABC):
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    def get_system_prompt(self, context: Dict[str, Any]) -> str:
        agent_prompt = self.get_agent_prompt(context)
        
        recent_memories = context.get("recent_memories", [])
        memory_string = f"Recent persistent memories about this user:\n{chr(10).join(recent_memories)}" if recent_memories else "No persistent memories found yet."

        today_totals = context.get("today_totals", {})
        
        return f"{agent_prompt}\n\nUSER PROFILE\n- Name: {context.get('name', 'User')}\n- Health Mode: {context.get('mode', 'standard')}\n- Today's Totals: {today_totals}\n\n{memory_string}"

    @abstractmethod
    def get_agent_prompt(self, context: Dict[str, Any]) -> str:
        pass

    async def process(self, message: str, context: Dict[str, Any], history: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        if history is None:
            history = []
        
        system_prompt = self.get_system_prompt(context)
        
        messages = history + [{"role": "user", "content": message}]
        
        async for token in default_provider.stream_chat(system_prompt, messages, model="claude-3-5-sonnet-20240620"):
            yield token
