from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import WorkoutResponse, WorkoutCreate, WorkoutUpdate
from app.models.wellness import Workout

router = APIRouter(prefix="/workouts", tags=["workouts"])

@router.get("", response_model=List[WorkoutResponse])
async def list_workouts(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Workout).order_by(Workout.logged_at.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=WorkoutResponse)
async def create_workout(workout: WorkoutCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_workout = Workout(**workout.dict(exclude_unset=True))
    wellness_repo.session.add(new_workout)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_workout)
    return new_workout


@router.put("/{id}", response_model=WorkoutResponse)
async def update_workouts(id: uuid.UUID, data: WorkoutUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Workout).where(Workout.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    
    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
        
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(item)
    return item

@router.delete("/{id}")
async def delete_workouts(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Workout).where(Workout.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}


# --- AI Fitness Hub Endpoints ---
from app.ai.provider import default_provider
from app.schemas.wellness import WorkoutAISummaryResponse, WorkoutReadinessResponse, WorkoutInsightsResponse, WorkoutChallengesResponse
from datetime import date, datetime, timedelta
import json

@router.post("/{id}/ai-summary", response_model=WorkoutAISummaryResponse)
async def generate_workout_summary(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Workout).where(Workout.id == id)
    result = await wellness_repo.session.execute(stmt)
    workout = result.scalar_one_or_none()
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
        
    prompt = f"""
    The user completed a workout:
    - Type: {workout.type}
    - Duration: {workout.duration_minutes} minutes
    - Calories Burned: {workout.calories_burned} kcal
    - Steps: {workout.steps}
    - Intensity: {workout.intensity}
    - Distance: {workout.distance_km or 'N/A'} km
    - Avg Heart Rate: {workout.avg_heart_rate or 'N/A'} bpm
    - Notes: {workout.notes or 'N/A'}
    
    Write a short 1-2 sentence personalized assessment. Be direct and encouraging.
    """
    
    summary = await default_provider.generate_chat(
        system_prompt="You are a personal fitness coach.",
        messages=[{"role": "user", "content": prompt}]
    )
    return {"summary": summary}


@router.get("/readiness", response_model=WorkoutReadinessResponse)
async def get_workout_readiness(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    target_date = datetime.utcnow().date()
    totals = await wellness_repo.get_day_totals(target_date)
    
    # Calculate score based on today's logged totals and sleep
    sleep_hrs = 0.0
    if totals.get("sleepRow"):
        sleep_hrs = float(totals["sleepRow"].duration_hours)
    
    water_ml = sum(getattr(h, "amount_ml", 0) or 0 for h in totals.get("dayHydration", []))
    mood_score = (sum(getattr(m, "mood_score", 0) or 0 for m in totals.get("dayMental", [])) / len(totals.get("dayMental", []))) if totals.get("dayMental") else 7.0
    
    # Fetch recent workouts for strain
    workouts = totals.get("dayWorkouts", [])
    workout_mins = sum(getattr(w, "duration_minutes", 0) or 0 for w in workouts)
    
    prompt = f"""
    Calculate a daily health readiness score (0-100) based on:
    - Sleep Hours: {sleep_hrs} (target 8)
    - Water Intake: {water_ml}ml (target 2000ml)
    - Mood Score: {mood_score}/10
    - Workout Duration Today: {workout_mins} minutes
    
    Return ONLY a JSON object:
    {{
      "readiness_score": integer (0 to 100),
      "explanation": "A 1-sentence explanation of why the score was assigned and advice for today"
    }}
    """
    try:
        raw = await default_provider.generate_chat(
            system_prompt="You are a health intelligence system. Output only raw JSON.",
            messages=[{"role": "user", "content": prompt}],
            json_mode=True
        )
        parsed = json.loads(raw)
        return {
            "readiness_score": parsed.get("readiness_score", 75),
            "explanation": parsed.get("explanation", "You have a solid readiness level today. Keep active and stay hydrated!")
        }
    except Exception:
        return {
            "readiness_score": 75,
            "explanation": "You have a solid readiness level today. Keep active and stay hydrated!"
        }


@router.get("/insights", response_model=WorkoutInsightsResponse)
async def get_workout_insights(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    today = datetime.utcnow().date()
    all_workouts = []
    for i in range(14):
        d = today - timedelta(days=i)
        totals = await wellness_repo.get_day_totals(d)
        all_workouts.extend(totals.get("dayWorkouts", []))
        
    workout_summary = "\n".join([
        f"- {w.logged_at.date()}: {w.type} ({w.duration_minutes} min, {w.calories_burned} kcal, {w.intensity} intensity)"
        for w in all_workouts
    ])
    
    prompt = f"""
    Review this workout history for the last 14 days:
    {workout_summary}
    
    Provide 3 bullet points of personalized fitness insights (e.g. consistency, recovery patterns, improvement).
    Return ONLY a JSON object:
    {{
      "insights": [
        "Insight 1...",
        "Insight 2...",
        "Insight 3..."
      ]
    }}
    """
    try:
        raw = await default_provider.generate_chat(
            system_prompt="You are a fitness analyst. Output only raw JSON.",
            messages=[{"role": "user", "content": prompt}],
            json_mode=True
        )
        parsed = json.loads(raw)
        return {"insights": parsed.get("insights", ["Keep tracking your workouts to see insights.", "Vary your workout intensity for better recovery.", "Hydrate properly pre and post exercise."])}
    except Exception:
        return {"insights": ["Keep tracking your workouts to see insights.", "Vary your workout intensity for better recovery.", "Hydrate properly pre and post exercise."]}


@router.get("/challenges", response_model=WorkoutChallengesResponse)
async def get_workout_challenges(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    today = datetime.utcnow().date()
    all_workouts = []
    for i in range(7):
        d = today - timedelta(days=i)
        totals = await wellness_repo.get_day_totals(d)
        all_workouts.extend(totals.get("dayWorkouts", []))
        
    prompt = f"""
    The user has done {len(all_workouts)} workouts in the last 7 days.
    Generate 3 realistic, motivating fitness challenges for them to complete this week (e.g. "Complete a 30-minute cardio session", "Walk 8,000 steps today").
    
    Return ONLY a JSON object:
    {{
      "challenges": [
        "Challenge 1...",
        "Challenge 2...",
        "Challenge 3..."
      ]
    }}
    """
    try:
        raw = await default_provider.generate_chat(
            system_prompt="You are a motivational coach. Output only raw JSON.",
            messages=[{"role": "user", "content": prompt}],
            json_mode=True
        )
        parsed = json.loads(raw)
        return {"challenges": parsed.get("challenges", ["Walk 8,000 steps today.", "Try a 15-minute yoga session for recovery.", "Burn 400 active calories in a single session."])}
    except Exception:
        return {"challenges": ["Walk 8,000 steps today.", "Try a 15-minute yoga session for recovery.", "Burn 400 active calories in a single session."]}
