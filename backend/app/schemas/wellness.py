from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, date
import uuid
from pydantic.alias_generators import to_camel

class BaseSchema(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        alias_generator=to_camel,
    )

# --- Profile ---
class ProfileBase(BaseSchema):
    name: str
    mode: str = "standard"
    daily_calorie_target: int = 2100
    daily_protein_target: int = 110
    daily_sleep_target_hours: float = 8.0
    daily_steps_target: int = 9000
    daily_screen_time_limit_minutes: int = 180
    glucose_target_low: int = 80
    glucose_target_high: int = 140
    daily_carb_limit: int = 180
    onboarding_complete: bool = False

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(BaseSchema):
    name: Optional[str] = None
    mode: Optional[str] = None
    daily_calorie_target: Optional[int] = None
    daily_protein_target: Optional[int] = None
    daily_sleep_target_hours: Optional[float] = None
    daily_steps_target: Optional[int] = None
    daily_screen_time_limit_minutes: Optional[int] = None
    glucose_target_low: Optional[int] = None
    glucose_target_high: Optional[int] = None
    daily_carb_limit: Optional[int] = None
    onboarding_complete: Optional[bool] = None

class ProfileResponse(ProfileBase):
    id: str | uuid.UUID
    avatar_color: str = "aurora"
    premium: bool = False
    joined_at: datetime

# --- Meal ---
class MealItem(BaseSchema):
    name: str
    quantity: str
    calories: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    confidence: Optional[float] = None
    vitamins: Optional[str] = None

class MealBase(BaseSchema):
    name: str
    meal_type: str
    calories: int
    protein_grams: int
    carbs_grams: int
    fat_grams: int
    items: Optional[List[MealItem]] = None
    photo_url: Optional[str] = None
    vitamins: Optional[str] = None
    source: str = "manual"

class MealCreate(MealBase):
    pass

class MealUpdate(BaseSchema):
    name: Optional[str] = None
    meal_type: Optional[str] = None
    calories: Optional[int] = None
    protein_grams: Optional[int] = None
    carbs_grams: Optional[int] = None
    fat_grams: Optional[int] = None
    items: Optional[List[MealItem]] = None
    photo_url: Optional[str] = None
    vitamins: Optional[str] = None

class MealResponse(MealBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- Workout ---
class WorkoutBase(BaseSchema):
    type: str
    duration_minutes: int
    calories_burned: int
    steps: int = 0
    intensity: str
    source: str = "manual"
    distance_km: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    notes: Optional[str] = None

class WorkoutCreate(WorkoutBase):
    pass

class WorkoutUpdate(BaseSchema):
    type: Optional[str] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    steps: Optional[int] = None
    intensity: Optional[str] = None
    source: Optional[str] = None
    distance_km: Optional[float] = None
    avg_heart_rate: Optional[int] = None
    notes: Optional[str] = None

class WorkoutResponse(WorkoutBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- Sleep ---
class SleepSessionBase(BaseSchema):
    date: str | date
    duration_hours: float
    quality: str
    bedtime: str
    wake_time: str
    deep_sleep_hours: Optional[float] = None
    notes: Optional[str] = None

class SleepSessionCreate(SleepSessionBase):
    pass

class SleepSessionUpdate(BaseSchema):
    date: Optional[str | date] = None
    duration_hours: Optional[float] = None
    quality: Optional[str] = None
    bedtime: Optional[str] = None
    wake_time: Optional[str] = None
    deep_sleep_hours: Optional[float] = None
    notes: Optional[str] = None

class SleepSessionResponse(SleepSessionBase):
    id: str | uuid.UUID

# --- Dashboard ---
class CategoryScore(BaseSchema):
    category: str
    score: float
    label: str

class TopRecommendation(BaseSchema):
    id: str
    category: str
    title: str
    body: str
    priority: str
    action: Optional[str] = None
    mode_context: Optional[str] = None

class Briefing(BaseSchema):
    title: str
    summary: str
    priorities: List[str]

class TodayDashboardResponse(BaseSchema):
    date: str
    overall_score: float
    scores: List[CategoryScore]
    calories_consumed: int
    calories_target: int
    protein_grams: int
    protein_target: int
    carbs_grams: int
    fat_grams: int
    steps: int
    steps_target: int
    active_minutes: int
    sleep_hours: float
    sleep_target: float
    screen_time_minutes: int
    screen_time_limit: int
    water_cups: int
    mood_label: str
    top_recommendation: TopRecommendation
    briefing: Briefing

class TimelineSummaryResponse(BaseSchema):
    summary: str

# --- Hydration ---
class HydrationBase(BaseSchema):
    amount_ml: int
    beverage_type: str = "water"

class HydrationCreate(HydrationBase):
    pass

class HydrationUpdate(BaseSchema):
    amount_ml: Optional[int] = None
    beverage_type: Optional[str] = None

class HydrationResponse(HydrationBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- BodyMeasurement ---
class BodyMeasurementBase(BaseSchema):
    weight_kg: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    waist_circumference_cm: Optional[float] = None

class BodyMeasurementCreate(BodyMeasurementBase):
    pass

class BodyMeasurementUpdate(BaseSchema):
    weight_kg: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    waist_circumference_cm: Optional[float] = None

class BodyMeasurementResponse(BodyMeasurementBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- VitalSign ---
class VitalSignBase(BaseSchema):
    heart_rate_bpm: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    body_temperature_celsius: Optional[float] = None
    blood_oxygen_percentage: Optional[int] = None

class VitalSignCreate(VitalSignBase):
    pass

class VitalSignUpdate(BaseSchema):
    heart_rate_bpm: Optional[int] = None
    blood_pressure_systolic: Optional[int] = None
    blood_pressure_diastolic: Optional[int] = None
    body_temperature_celsius: Optional[float] = None
    blood_oxygen_percentage: Optional[int] = None

class VitalSignResponse(VitalSignBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- MentalWellness ---
class MentalWellnessBase(BaseSchema):
    mood_score: int
    stress_level: int
    notes: Optional[str] = None

class MentalWellnessCreate(MentalWellnessBase):
    pass

class MentalWellnessUpdate(BaseSchema):
    mood_score: Optional[int] = None
    stress_level: Optional[int] = None
    notes: Optional[str] = None

class MentalWellnessResponse(MentalWellnessBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- Medication ---
class MedicationBase(BaseSchema):
    name: str
    dosage: str
    taken: bool = False
    scheduled_for: datetime

class MedicationCreate(MedicationBase):
    pass

class MedicationUpdate(BaseSchema):
    name: Optional[str] = None
    dosage: Optional[str] = None
    taken: Optional[bool] = None
    scheduled_for: Optional[datetime] = None

class MedicationResponse(MedicationBase):
    id: str | uuid.UUID
    taken_at: Optional[datetime] = None

# --- ScreenTimeEntry ---
class ScreenTimeEntryBase(BaseSchema):
    category: str
    duration_seconds: int
    started_at: datetime
    ended_at: datetime

class ScreenTimeEntryCreate(ScreenTimeEntryBase):
    pass

class ScreenTimeEntryUpdate(BaseSchema):
    category: Optional[str] = None
    duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

class ScreenTimeEntryResponse(ScreenTimeEntryBase):
    id: str | uuid.UUID

# --- GlucoseReading ---
class GlucoseReadingBase(BaseSchema):
    reading_mgdl: int
    context_type: str
    notes: Optional[str] = None

class GlucoseReadingCreate(GlucoseReadingBase):
    pass

class GlucoseReadingUpdate(BaseSchema):
    reading_mgdl: Optional[int] = None
    context_type: Optional[str] = None
    notes: Optional[str] = None

class GlucoseReadingResponse(GlucoseReadingBase):
    id: str | uuid.UUID
    logged_at: datetime

# --- Reminder ---
class ReminderBase(BaseSchema):
    title: str
    time: str
    category: str
    enabled: bool = True
    repeat_days: List[str] = []
    ai_generated: bool = False

class ReminderCreate(ReminderBase):
    pass

class ReminderUpdate(BaseSchema):
    title: Optional[str] = None
    time: Optional[str] = None
    category: Optional[str] = None
    enabled: Optional[bool] = None
    repeat_days: Optional[List[str]] = None

class ReminderResponse(ReminderBase):
    id: uuid.UUID
    created_at: datetime


# --- Fitness Hub AI Response Schemas ---
class WorkoutAISummaryResponse(BaseSchema):
    summary: str

class WorkoutReadinessResponse(BaseSchema):
    readiness_score: int
    explanation: str

class WorkoutInsightsResponse(BaseSchema):
    insights: List[str]

class WorkoutChallengesResponse(BaseSchema):
    challenges: List[str]
