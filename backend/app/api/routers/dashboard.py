from fastapi import APIRouter, Depends
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from typing import Dict, Any
from functools import lru_cache
import time

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
    cache_key = f"dashboard_today_{profile.id}"
    
    # Check cache
    if cache_key in dashboard_cache:
        cached_data, timestamp = dashboard_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            return cached_data
            
    # If not in cache, construct the response
    # This is a mocked structure that the frontend expects based on useGetTodayDashboard
    response = {
        "date": datetime.utcnow().date().isoformat(),
        "overall_score": 8.5,
        "scores": [
            {"category": "nutrition", "score": 8.0, "label": "On track"},
            {"category": "activity", "score": 9.2, "label": "Excellent"},
            {"category": "sleep", "score": 7.5, "label": "Fair"},
            {"category": "mindfulness", "score": 8.5, "label": "Good"}
        ],
        "calories_consumed": 1450,
        "calories_target": 2200,
        "protein_grams": 85,
        "protein_target": 120,
        "carbs_grams": 150,
        "fat_grams": 45,
        "steps": 6500,
        "steps_target": 9000,
        "active_minutes": 45,
        "sleep_hours": 7.5,
        "sleep_target": 8.0,
        "screen_time_minutes": 120,
        "screen_time_limit": 180,
        "water_cups": 4,
        "mood_label": "Energetic",
        "top_recommendation": {
            "id": "1",
            "category": "hydration",
            "title": "Stay Hydrated",
            "body": "You're slightly behind on your water goal today.",
            "priority": "high",
            "action": "Log 1 Cup"
        },
        "briefing": {
            "title": "Morning Readiness",
            "summary": "You had a highly restorative sleep last night.",
            "priorities": [
                "Aim for 120g of protein",
                "Complete a high-intensity cardio session",
                "Hit 8 cups of water by 5 PM"
            ]
        }
    }
    
    # Set cache
    dashboard_cache[cache_key] = (response, time.time())
    
    return response

from datetime import datetime
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
