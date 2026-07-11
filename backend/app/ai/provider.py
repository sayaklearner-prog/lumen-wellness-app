from abc import ABC, abstractmethod
from typing import AsyncGenerator, List, Dict, Any
from app.core.config import settings
import httpx
import json

class AIProvider(ABC):
    @abstractmethod
    async def stream_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def generate_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str, json_mode: bool = False) -> str:
        pass


class AnthropicProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.base_url = "https://api.anthropic.com/v1/messages"
        self.headers = {
            "x-api-key": self.api_key or "DUMMY_KEY",
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

    async def stream_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str = "claude-3-5-sonnet-20240620") -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield "Mock response from Python Backend: Anthropic API key not set."
            return

        payload = {
            "model": model,
            "max_tokens": 8192,
            "system": system_prompt,
            "messages": messages,
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", self.base_url, headers=self.headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if data["type"] == "content_block_delta" and data["delta"]["type"] == "text_delta":
                                yield data["delta"]["text"]
                        except json.JSONDecodeError:
                            pass

    async def generate_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str = "claude-3-haiku-20240307", json_mode: bool = False) -> str:
        if not self.api_key:
            return "GENERAL"
            
        payload = {
            "model": model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": messages,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(self.base_url, headers=self.headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]

class OpenAICompatibleProvider(AIProvider):
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def stream_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str) -> AsyncGenerator[str, None]:
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
            "stream": True
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", f"{self.base_url}/chat/completions", headers=self.headers, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if "choices" in data and len(data["choices"]) > 0:
                                delta = data["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    yield delta["content"]
                        except json.JSONDecodeError:
                            pass

    async def generate_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str, json_mode: bool = False) -> str:
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}] + messages,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
            
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(f"{self.base_url}/chat/completions", headers=self.headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]


class FallbackAIProvider(AIProvider):
    def __init__(self):
        self.openai = OpenAICompatibleProvider(
            base_url="https://api.openai.com/v1",
            api_key=settings.OPENAI_API_KEY or ""
        )
        self.anthropic = AnthropicProvider()
        self.featherless = OpenAICompatibleProvider(
            base_url="https://api.featherless.ai/v1", 
            api_key=settings.FEATHERLESS_API_KEY or ""
        )
        self.aiml = OpenAICompatibleProvider(
            base_url="https://api.aimlapi.com/v1", 
            api_key=settings.AIML_API_KEY or ""
        )

    async def stream_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str = "gpt-4o-mini") -> AsyncGenerator[str, None]:
        if settings.OPENAI_API_KEY:
            try:
                # Always use gpt-4o-mini for speed and cost efficiency
                async for token in self.openai.stream_chat(system_prompt, messages, "gpt-4o-mini"):
                    yield token
                return
            except Exception as e:
                pass # Fallback

        if settings.ANTHROPIC_API_KEY:
            try:
                async for token in self.anthropic.stream_chat(system_prompt, messages, "claude-3-5-sonnet-20240620"):
                    yield token
                return
            except Exception as e:
                pass # Fallback
                
        if settings.FEATHERLESS_API_KEY:
            try:
                async for token in self.featherless.stream_chat(system_prompt, messages, "meta-llama/Meta-Llama-3.1-8B-Instruct"):
                    yield token
                return
            except Exception as e:
                import logging
                logging.getLogger("uvicorn").error(f"Featherless streaming failed: {e}")

        if settings.AIML_API_KEY:
            try:
                # Use gpt-4o-mini for AIML as it's fully supported and cheap
                async for token in self.aiml.stream_chat(system_prompt, messages, "gpt-4o-mini"):
                    yield token
                return
            except Exception as e:
                import logging
                logging.getLogger("uvicorn").error(f"AIML streaming failed: {e}")

        yield "Please configure an OpenAI or Anthropic API key in backend/.env to enable the AI Coach."

    async def generate_chat(self, system_prompt: str, messages: List[Dict[str, Any]], model: str = "gpt-4o-mini", json_mode: bool = False) -> str:
        if settings.OPENAI_API_KEY:
            try:
                return await self.openai.generate_chat(system_prompt, messages, "gpt-4o-mini", json_mode=json_mode)
            except Exception as e:
                pass
                
        if settings.ANTHROPIC_API_KEY:
            try:
                return await self.anthropic.generate_chat(system_prompt, messages, "claude-3-haiku-20240307", json_mode=json_mode)
            except Exception as e:
                pass
                
        if settings.FEATHERLESS_API_KEY:
            try:
                return await self.featherless.generate_chat(system_prompt, messages, "meta-llama/Meta-Llama-3.1-8B-Instruct", json_mode=json_mode)
            except Exception as e:
                import logging
                logging.getLogger("uvicorn").error(f"Featherless generation failed: {e}")
                
        if settings.AIML_API_KEY:
            try:
                return await self.aiml.generate_chat(system_prompt, messages, "gpt-4o-mini", json_mode=json_mode)
            except Exception as e:
                import logging
                logging.getLogger("uvicorn").error(f"AIML generation failed: {e}")
                
        return "Please configure an OpenAI or Anthropic API key."


# Export default provider
default_provider = FallbackAIProvider()
