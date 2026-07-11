from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from typing import Dict, Any
import json
from loguru import logger
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.ai.provider import default_provider
from app.schemas.planner import WeeklyPlan, MonthlyPlan

router = APIRouter(prefix="/planner", tags=["planner"])

@router.get("/weekly", response_model=WeeklyPlan)
async def generate_weekly_plan(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    profile = await wellness_repo.get_or_create_profile()
    today = datetime.utcnow()
    
    system_prompt = "You are an expert AI Wellness Planner. Generate a highly personalized 7-day plan in JSON format based on the user's profile and goals."
    user_prompt = f"""
    User Name: {profile.name}
    Mode: {profile.mode}
    Primary Goal: {profile.primary_goal}
    Fitness Level: {profile.fitness_experience}
    
    Generate a 7-day wellness plan starting from {today.strftime('%A, %B %d')}. 
    The output MUST perfectly match this JSON structure:
    {{
      "theme": "A short, motivating theme for the week",
      "modeContext": "A brief note on how this fits their '{profile.mode}' mode",
      "days": [
        {{
          "weekday": "Monday",
          "date": "MMM DD",
          "focus": "Main focus for the day (e.g. Active Recovery, High Intensity)",
          "actions": [
            {{
              "title": "Action title",
              "detail": "Action detail/instructions",
              "targetValue": "Optional target like '30 mins' or '100g' (can be null)"
            }}
          ]
        }}
      ]
    }}
    Ensure exactly 7 days are provided.
    """
    
    try:
        response_text = await default_provider.generate_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            model="gpt-4o-mini",
            json_mode=True
        )
        
        # Parse the JSON string into dict
        plan_data = json.loads(response_text)
        return WeeklyPlan(**plan_data)
        
    except Exception as e:
        logger.error(f"Failed to generate weekly plan: {e}")
        # Return fallback mock data
        return WeeklyPlan(
            theme="Building Consistency",
            days=[
                {
                    "weekday": (today + timedelta(days=i)).strftime("%A"),
                    "date": (today + timedelta(days=i)).strftime("%b %d"),
                    "focus": "General Wellness",
                    "actions": [{"title": "Drink Water", "detail": "Stay hydrated", "targetValue": "8 cups"}]
                } for i in range(7)
            ]
        )

@router.get("/monthly", response_model=MonthlyPlan)
async def generate_monthly_plan(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    profile = await wellness_repo.get_or_create_profile()
    current_month = datetime.utcnow().strftime("%B")
    
    system_prompt = "You are an expert AI Wellness Planner. Generate a 4-week monthly overview in JSON format."
    user_prompt = f"""
    User Name: {profile.name}
    Mode: {profile.mode}
    Primary Goal: {profile.primary_goal}
    Fitness Level: {profile.fitness_experience}
    
    Generate a 4-week monthly wellness plan for the month of {current_month}.
    The output MUST perfectly match this JSON structure:
    {{
      "month": "{current_month}",
      "narrative": "A paragraph explaining the overarching strategy for the month.",
      "modeContext": "A brief note on how this fits their '{profile.mode}' mode",
      "weeks": [
        {{
          "weekLabel": "Week 1",
          "theme": "Theme for the week",
          "goals": ["Goal 1", "Goal 2", "Goal 3"]
        }}
      ]
    }}
    Ensure exactly 4 weeks are provided.
    """
    
    try:
        response_text = await default_provider.generate_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            model="gpt-4o-mini",
            json_mode=True
        )
        
        plan_data = json.loads(response_text)
        return MonthlyPlan(**plan_data)
        
    except Exception as e:
        logger.error(f"Failed to generate monthly plan: {e}")
        return MonthlyPlan(
            month=current_month,
            narrative="Focus on steady progress.",
            weeks=[
                {"weekLabel": f"Week {i+1}", "theme": "Consistency", "goals": ["Stay active", "Eat well"]} for i in range(4)
            ]
        )
