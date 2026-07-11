from pydantic import BaseModel
from typing import List, Optional
from app.schemas.wellness import BaseSchema

class ActionItem(BaseSchema):
    title: str
    detail: str
    targetValue: Optional[str] = None

class DailyPlan(BaseSchema):
    weekday: str
    date: str
    focus: str
    actions: List[ActionItem]

class WeeklyPlan(BaseSchema):
    theme: str
    modeContext: Optional[str] = None
    days: List[DailyPlan]

class WeeklyGoalItem(BaseSchema):
    weekLabel: str
    theme: str
    goals: List[str]

class MonthlyPlan(BaseSchema):
    month: str
    narrative: str
    modeContext: Optional[str] = None
    weeks: List[WeeklyGoalItem]
