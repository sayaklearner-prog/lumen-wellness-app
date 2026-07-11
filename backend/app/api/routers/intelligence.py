from fastapi import APIRouter, Depends
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.ai.provider import default_provider
from datetime import datetime, timedelta
from pydantic import BaseModel
from pydantic.alias_generators import to_camel
from typing import List, Optional
import json

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


class IntelligenceResponse(BaseModel):
    model_config = {"populate_by_name": True, "alias_generator": to_camel}
    synthesis: str
    consistency_score: str
    avg_recovery: str
    top_metric: str
    goal_probability: str
    adjustments: str
    period: str


@router.get("/report", response_model=IntelligenceResponse)
async def get_intelligence_report(
    period: str = "weekly",
    wellness_repo: WellnessRepository = Depends(get_wellness_repo),
):
    """Generate a personalized AI Health Intelligence report using the user's real data."""

    # ── 1. Gather the user's real data from the last 7 (or 30) days ──
    profile = await wellness_repo.get_or_create_profile()
    today = datetime.utcnow().date()
    days = 7 if period == "weekly" else 30

    all_meals = []
    all_workouts = []
    all_hydration = []
    all_sleep = []
    all_vitals = []
    all_mental = []

    for i in range(days):
        d = today - timedelta(days=i)
        try:
            totals = await wellness_repo.get_day_totals(d)
            all_meals.extend(totals.get("dayMeals", []))
            all_workouts.extend(totals.get("dayWorkouts", []))
            all_hydration.extend(totals.get("dayHydration", []))
            all_mental.extend(totals.get("dayMental", []))
            all_vitals.extend(totals.get("dayVitals", []))
            if totals.get("sleepRow"):
                all_sleep.append(totals["sleepRow"])
        except Exception:
            pass

    # ── 2. Build a data summary string ──
    total_cals = sum(getattr(m, "calories", 0) or 0 for m in all_meals)
    total_protein = sum(getattr(m, "protein_grams", 0) or 0 for m in all_meals)
    total_water_ml = sum(getattr(h, "amount_ml", 0) or 0 for h in all_hydration)
    total_workouts = len(all_workouts)
    total_workout_mins = sum(getattr(w, "duration_minutes", 0) or 0 for w in all_workouts)
    total_calories_burned = sum(getattr(w, "calories_burned", 0) or 0 for w in all_workouts)
    avg_sleep = (sum(getattr(s, "duration_hours", 0) or 0 for s in all_sleep) / len(all_sleep)) if all_sleep else 0
    avg_mood = (sum(getattr(m, "mood_score", 0) or 0 for m in all_mental) / len(all_mental)) if all_mental else 0
    avg_hr = (sum(getattr(v, "heart_rate_bpm", 0) or 0 for v in all_vitals) / len(all_vitals)) if all_vitals else 0

    data_summary = f"""
USER PROFILE:
- Name: {profile.name}
- Health Mode: {profile.mode}
- Daily Calorie Target: {getattr(profile, 'daily_calorie_target', 2100)} kcal
- Daily Protein Target: {getattr(profile, 'daily_protein_target', 110)} g
- Daily Steps Target: {getattr(profile, 'daily_steps_target', 9000)}
- Daily Sleep Target: {getattr(profile, 'daily_sleep_target_hours', 8)} hours

LAST {days} DAYS DATA:
- Meals logged: {len(all_meals)}
- Total calories consumed: {total_cals} kcal (avg {total_cals // max(days, 1)}/day vs target {getattr(profile, 'daily_calorie_target', 2100)})
- Total protein consumed: {total_protein}g (avg {total_protein // max(days, 1)}g/day vs target {getattr(profile, 'daily_protein_target', 110)}g)
- Total water intake: {total_water_ml}ml (avg {total_water_ml // max(days, 1)}ml/day)
- Workouts completed: {total_workouts}
- Total workout minutes: {total_workout_mins} min
- Total calories burned: {total_calories_burned} kcal
- Sleep sessions logged: {len(all_sleep)}
- Average sleep duration: {avg_sleep:.1f} hours/night
- Average mood score: {avg_mood:.1f}/10
- Average heart rate: {avg_hr:.0f} bpm (if tracked)
- Mood logs: {len(all_mental)}
- Vitals logged: {len(all_vitals)}
"""

    # ── 3. Call the AI for a personalized analysis ──
    system_prompt = """You are an expert AI health analyst for Lumen Health OS. 
You MUST respond ONLY with a valid JSON object, no markdown, no code fences, no extra text.
Your job is to analyze the user's REAL health data and produce a personalized intelligence report.

CRITICAL RULES:
- ONLY reference numbers and facts from the provided data. Do NOT invent data.
- If a metric has no data (0 logs), say "No data logged yet" for that metric.
- Be specific: use the user's actual numbers, averages, and targets.
- Give actionable, personalized recommendations based on patterns you see.

Respond with this exact JSON structure:
{
  "synthesis": "A 2-3 sentence personalized weekly/monthly synthesis based on real data patterns",
  "consistency_score": "A percentage or 'N/A' based on how consistently the user logged data",
  "avg_recovery": "An overall health/recovery score like '72/100' based on sleep, mood, activity balance",
  "top_metric": "The user's strongest metric with a value, e.g. '+15g protein avg' or 'N/A'",
  "goal_probability": "A sentence about how likely they are to hit their goals based on real trajectory",
  "adjustments": "1-2 specific actionable recommendations based on the data patterns"
}"""

    user_msg = f"Here is my health data for the last {days} days. Please analyze it and give me personalized insights:\n\n{data_summary}"

    try:
        raw = await default_provider.generate_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
            json_mode=True,
        )
        parsed = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        # Fallback if AI response isn't valid JSON
        parsed = {
            "synthesis": raw if isinstance(raw, str) else "Unable to generate analysis. Please check your API key configuration.",
            "consistency_score": "N/A",
            "avg_recovery": "N/A",
            "top_metric": "N/A",
            "goal_probability": "Insufficient data to predict.",
            "adjustments": "Start logging your meals, workouts, and sleep to get personalized recommendations.",
        }

    parsed["period"] = period
    return parsed
