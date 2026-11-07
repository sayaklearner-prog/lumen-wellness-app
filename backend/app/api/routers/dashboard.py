from fastapi import APIRouter, Depends
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from typing import Dict, Any
from functools import lru_cache
import time
from datetime import datetime

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Simple in-memory cache for dashboard responses (simulating Redis/Memcached)
# In production, use aioredis or fastapi-cache2
dashboard_cache: Dict[str, Any] = {}
CACHE_TTL = 300  # 5 minutes

from app.schemas.wellness import TodayDashboardResponse, TimelineSummaryResponse
from app.ai.provider import default_provider

@router.get("/today", response_model=TodayDashboardResponse)
async def get_today_dashboard(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    profile = await wellness_repo.get_or_create_profile()
    today_date_str = datetime.utcnow().date().isoformat()
    cache_key = f"dashboard_today_{profile.id}_{today_date_str}"
    
    # Check cache
    if cache_key in dashboard_cache:
        cached_data, timestamp = dashboard_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
            
    target_date = datetime.utcnow().date()
    totals = await wellness_repo.get_day_totals(target_date)
    
    cal_consumed = sum(m.calories for m in totals["dayMeals"])
    protein = sum(m.protein_grams for m in totals["dayMeals"])
    carbs = sum(m.carbs_grams for m in totals["dayMeals"])
    fat = sum(m.fat_grams for m in totals["dayMeals"])
    
    steps = sum(w.steps or 0 for w in totals["dayWorkouts"])
    active_mins = sum(w.duration_minutes for w in totals["dayWorkouts"])
    
    water_ml = sum(h.amount_ml for h in totals["dayHydration"])
    water_cups = round(water_ml / 250) if water_ml > 0 else 0
    
    sleep_hours = totals["sleepRow"].duration_hours if totals.get("sleepRow") else 0.0
    screen_mins = totals["screenRow"].screen_time_minutes if totals.get("screenRow") else 0
    
    # Dynamic scores based on real day progress
    cal_target = getattr(profile, "daily_calorie_target", 2100) or 2100
    pro_target = getattr(profile, "daily_protein_target", 110) or 110
    step_target = getattr(profile, "daily_steps_target", 9000) or 9000
    sleep_target = getattr(profile, "daily_sleep_target_hours", 8.0) or 8.0
    
    nutrition_score = round(min(10.0, (cal_consumed / cal_target * 5 + protein / pro_target * 5)), 1) if cal_consumed > 0 else 0.0
    activity_score = round(min(10.0, (steps / step_target * 7 + (active_mins / 45) * 3)), 1) if (steps > 0 or active_mins > 0) else 0.0
    sleep_score = round(min(10.0, (sleep_hours / sleep_target * 10)), 1) if sleep_hours > 0 else 0.0
    mindfulness_score = 8.5
    
    active_pillars = []
    if nutrition_score > 0: active_pillars.append(nutrition_score)
    if activity_score > 0: active_pillars.append(activity_score)
    if sleep_score > 0: active_pillars.append(sleep_score)
    overall_score = round(sum(active_pillars) / len(active_pillars), 1) if active_pillars else 0.0

    response = {
        "date": today_date_str,
        "overall_score": overall_score,
        "scores": [
            {"category": "nutrition", "score": nutrition_score, "label": "On track" if nutrition_score >= 7.0 else "Log meals"},
            {"category": "activity", "score": activity_score, "label": "Active" if activity_score >= 6.0 else "Standby"},
            {"category": "sleep", "score": sleep_score, "label": "Restored" if sleep_score >= 7.0 else "Standby"},
            {"category": "mindfulness", "score": mindfulness_score, "label": "Good"}
        ],
        "calories_consumed": cal_consumed,
        "calories_target": cal_target,
        "protein_grams": protein,
        "protein_target": pro_target,
        "carbs_grams": carbs,
        "fat_grams": fat,
        "steps": steps,
        "steps_target": step_target,
        "active_minutes": active_mins,
        "sleep_hours": sleep_hours,
        "sleep_target": sleep_target,
        "screen_time_minutes": screen_mins,
        "screen_time_limit": 180,
        "water_cups": water_cups,
        "mood_label": "Energetic",
        "top_recommendation": {
            "id": "1",
            "category": "hydration",
            "title": "Stay Hydrated",
            "body": "Hydrate consistently throughout the day.",
            "priority": "high",
            "action": "Log 1 Cup"
        },
        "briefing": {
            "title": "Daily Telemetry",
            "summary": "Start tracking movement and nutrition for today.",
            "priorities": [
                f"Aim for {pro_target}g of protein",
                f"Complete {step_target:,} steps",
                "Hit 8 cups of water by 5 PM"
            ]
        }
    }
    
    # Set cache
    dashboard_cache[cache_key] = (response, time.time())
    
    return response

from pydantic import BaseModel
from typing import List
from pydantic.alias_generators import to_camel

class TimelineEvent(BaseModel):
    model_config = {"populate_by_name": True, "alias_generator": to_camel}
    id: str
    type: str
    title: str
    description: str
    timestamp: str
    icon: str

@router.get("/timeline", response_model=List[TimelineEvent])
async def get_timeline(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    target_date = datetime.utcnow().date()
    totals = await wellness_repo.get_day_totals(target_date)
    
    events = []
    
    for m in totals["dayMeals"]:
        events.append({
            "id": str(m.id),
            "type": "meal",
            "title": f"Logged {m.meal_type}: {m.name}",
            "description": f"{m.calories} kcal • {m.protein_grams}g Protein",
            "timestamp": m.logged_at.isoformat(),
            "icon": "utensils"
        })
        
    for w in totals["dayWorkouts"]:
        events.append({
            "id": str(w.id),
            "type": "workout",
            "title": f"{w.type} Workout",
            "description": f"{w.duration_minutes} min • {w.calories_burned} kcal",
            "timestamp": w.logged_at.isoformat(),
            "icon": "activity"
        })
        
    for h in totals["dayHydration"]:
        events.append({
            "id": str(h.id),
            "type": "hydration",
            "title": "Hydration",
            "description": f"{h.amount_ml}ml of {h.beverage_type}",
            "timestamp": h.logged_at.isoformat(),
            "icon": "droplet"
        })
        
    for mv in totals["dayMental"]:
        events.append({
            "id": str(mv.id),
            "type": "mood",
            "title": "Mood Logged",
            "description": f"Score: {mv.mood_score}/10",
            "timestamp": mv.logged_at.isoformat(),
            "icon": "smile"
        })
        
    for v in totals["dayVitals"]:
        events.append({
            "id": str(v.id),
            "type": "vitals",
            "title": "Vitals Logged",
            "description": f"HR: {v.heart_rate_bpm} bpm",
            "timestamp": v.logged_at.isoformat(),
            "icon": "heart"
        })
        
    for md in totals["dayMeds"]:
        if md.taken_at:
            events.append({
                "id": str(md.id),
                "type": "medication",
                "title": f"Took {md.name}",
                "description": f"Dosage: {md.dosage}",
                "timestamp": md.taken_at.isoformat(),
                "icon": "pill"
            })
            
    if totals["sleepRow"]:
        s = totals["sleepRow"]
        events.append({
            "id": str(s.id),
            "type": "sleep",
            "title": "Sleep Logged",
            "description": f"{s.duration_hours} hrs • {s.quality} quality",
            "timestamp": f"{s.date.isoformat()}T{s.wake_time}:00Z",
            "icon": "moon"
        })
        
    # Sort events chronologically (newest first)
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    return events

@router.get("/timeline/summary", response_model=TimelineSummaryResponse)
async def get_timeline_summary(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    events = await get_timeline(wellness_repo)
    if not events:
        return {"summary": "No events logged today. Start logging to see a summary!"}
    
    events_text = "\\n".join([f"- {e['timestamp']}: {e['title']} ({e['description']})" for e in events])
    prompt = f"Here is my timeline of events for today:\\n{events_text}\\nPlease provide a short AI summary of my day."
    summary_text = await default_provider.generate_chat(
        system_prompt="You are a health AI summarizer.",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"summary": summary_text}

@router.get("/streaks")
async def get_streaks():
    return [
        {"id": "1", "category": "nutrition", "days": 5, "message": "5 days of hitting protein goals"},
        {"id": "2", "category": "activity", "days": 12, "message": "12 days active"}
    ]

scores_router = APIRouter(prefix="/scores", tags=["scores"])

@scores_router.get("/trend")
async def get_score_trend(range: str = "week"):
    return [
        {"label": "Mon", "overall": 7.5},
        {"label": "Tue", "overall": 8.0},
        {"label": "Wed", "overall": 8.2},
        {"label": "Thu", "overall": 7.9},
        {"label": "Fri", "overall": 8.5},
        {"label": "Sat", "overall": 9.0},
        {"label": "Sun", "overall": 8.8}
    ]
