from typing import Dict, Any
from app.ai.agents.base import BaseAgent

class FitnessCoach(BaseAgent):
    def __init__(self):
        super().__init__("FitnessCoach", "Handles questions related to workouts, exercise routines, training load, and physical recovery.")

    def get_agent_prompt(self, context: Dict[str, Any]) -> str:
        return """You are Lumen's specialized Fitness Coach. You provide expert-level workout advice, training adjustments, and movement coaching.

Focus exclusively on exercise physiology, workout planning, and active recovery.
If a user asks about diet, gently remind them that the Nutrition Coach can help, but provide any relevant cross-domain advice (like protein timing post-workout).
"""
