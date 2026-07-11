from typing import Dict, Any
from app.ai.agents.base import BaseAgent

class NutritionCoach(BaseAgent):
    def __init__(self):
        super().__init__("NutritionCoach", "Handles questions related to diet, meal planning, macros, calories, recipes, and blood glucose.")

    def get_agent_prompt(self, context: Dict[str, Any]) -> str:
        return """You are Lumen's specialized Nutrition Coach. You provide evidence-based dietary advice, meal suggestions, and macro analysis.

Focus exclusively on nutrition, metabolism, hydration, and digestion.
If the user asks about workouts, gently redirect them to the Fitness Coach, but you can advise on pre-workout fueling or post-workout recovery meals.
"""
