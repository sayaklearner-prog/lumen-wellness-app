from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository

router = APIRouter(prefix="/goals", tags=["goals"])

# Mocked in-memory store for Phase 9 implementation
# In a full implementation, these would be backed by SQLAlchemy models
user_goals: Dict[str, List[Dict[str, Any]]] = {}

@router.get("/")
async def get_goals(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    """Fetch active goals and habit tracking status for the user."""
    profile = await wellness_repo.get_or_create_profile()
    
    if profile.id not in user_goals:
        # Initialize default goal
        user_goals[profile.id] = [
            {
                "id": "g_1",
                "title": "Marathon Training Phase 1",
                "category": "activity",
                "target_date": "2026-10-15",
                "progress_percentage": 35,
                "status": "on_track",
                "habit_warnings": []
            }
        ]
        
    return user_goals[profile.id]

@router.post("/")
async def create_goal(goal_data: dict, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    """Create a new long-term goal."""
    profile = await wellness_repo.get_or_create_profile()
    
    if profile.id not in user_goals:
        user_goals[profile.id] = []
        
    new_goal = {
        "id": f"g_{len(user_goals[profile.id]) + 1}",
        "title": goal_data.get("title", "New Goal"),
        "category": goal_data.get("category", "wellness"),
        "target_date": goal_data.get("target_date"),
        "progress_percentage": 0,
        "status": "started",
        "habit_warnings": []
    }
    
    user_goals[profile.id].append(new_goal)
    return new_goal

@router.get("/habit-status")
async def get_habit_status(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    """
    Returns AI-detected habit decline warnings. 
    This hooks into the intelligence background worker analysis.
    """
    # Mocking habit decline detection
    return {
        "status": "warning",
        "message": "We've noticed you missed your last 3 strength sessions.",
        "recommended_intervention": {
            "title": "Reset & Recover",
            "action": "Schedule a light 15-minute mobility routine today to rebuild momentum."
        }
    }
