from typing import Dict, Any, List, AsyncGenerator
from loguru import logger
from app.ai.provider import default_provider
from app.ai.agents.base import BaseAgent
from app.ai.agents.fitness import FitnessCoach
from app.ai.agents.nutrition import NutritionCoach

class GenericFallbackAgent(BaseAgent):
    def __init__(self):
        super().__init__("GeneralWellness", "Fallback")

    def get_agent_prompt(self, context: Dict[str, Any]) -> str:
        return "You are Lumen's General Wellness Coach. Answer queries broadly related to wellness, sleep, screen time, or mindfulness."

class RouterAgent:
    def __init__(self):
        self.fitness = FitnessCoach()
        self.nutrition = NutritionCoach()
        self.generic_fallback = GenericFallbackAgent()

    async def route_and_process(self, message: str, context: Dict[str, Any], history: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        if history is None:
            history = []

        prompt = f"""Analyze the user's latest message and categorize their intent into one of the following classes:
1. "FITNESS": Queries about workouts, exercises, muscle soreness, steps.
2. "NUTRITION": Queries about meals, food, calories, protein, recipes, glucose.
3. "GENERAL": Everything else, including sleep, screen time, or general chat.

User Message: "{message}"

Output ONLY the category name (FITNESS, NUTRITION, or GENERAL).
"""
        try:
            intent = await default_provider.generate_chat(
                system_prompt="You are a routing classifier. Output a single word.",
                messages=[{"role": "user", "content": prompt}]
            )
            intent = intent.strip().upper()
            logger.info(f"Router classified intent: {intent} for message: {message}")

            if "FITNESS" in intent:
                selected_agent = self.fitness
            elif "NUTRITION" in intent:
                selected_agent = self.nutrition
            else:
                selected_agent = self.generic_fallback

            async for token in selected_agent.process(message, context, history):
                yield token

        except Exception as e:
            logger.error(f"Router failed, falling back to general agent: {e}")
            async for token in self.generic_fallback.process(message, context, history):
                yield token

router_agent = RouterAgent()
