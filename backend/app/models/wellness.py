from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Numeric, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.models.base import Base
import uuid

class Profile(Base):
    __tablename__ = "profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    avatar_color: Mapped[str] = mapped_column(String, nullable=False, default="aurora")
    mode: Mapped[str] = mapped_column(String, nullable=False, default="standard")
    premium: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    daily_calorie_target: Mapped[int] = mapped_column(Integer, nullable=False, default=2100)
    daily_protein_target: Mapped[int] = mapped_column(Integer, nullable=False, default=110)
    daily_sleep_target_hours: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False, default=8.00)
    daily_steps_target: Mapped[int] = mapped_column(Integer, nullable=False, default=9000)
    daily_screen_time_limit_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    
    # Diabetes-specific
    glucose_target_low: Mapped[int] = mapped_column(Integer, nullable=False, default=80)
    glucose_target_high: Mapped[int] = mapped_column(Integer, nullable=False, default=140)
    daily_carb_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=180)
    
    # Onboarding + permissions
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voice_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    motion_permission_granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    
    # Personal context for AI
    fitness_experience: Mapped[str] = mapped_column(String, nullable=False, default="beginner")
    primary_goal: Mapped[str] = mapped_column(String, nullable=False, default="general_wellness")
    allergies: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    medications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    medical_disclaimer_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Monetization
    premium_tier: Mapped[str] = mapped_column(String, nullable=False, default="free")
    premium_since: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class Meal(Base):
    __tablename__ = "meals"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    meal_type: Mapped[str] = mapped_column(String, nullable=False)
    calories: Mapped[int] = mapped_column(Integer, nullable=False)
    protein_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    carbs_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    fat_grams: Mapped[int] = mapped_column(Integer, nullable=False)
    items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    photo_url: Mapped[Optional[str]] = mapped_column(String)
    vitamins: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)


class Workout(Base):
    __tablename__ = "workouts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    calories_burned: Mapped[int] = mapped_column(Integer, nullable=False)
    steps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    intensity: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    distance_km: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    avg_heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)


class SleepEntry(Base):
    __tablename__ = "sleep_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    duration_hours: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    quality: Mapped[str] = mapped_column(String, nullable=False)
    bedtime: Mapped[str] = mapped_column(String, nullable=False)
    wake_time: Mapped[str] = mapped_column(String, nullable=False)
    deep_sleep_hours: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    notes: Mapped[Optional[str]] = mapped_column(String)


class ScreenTimeEntry(Base):
    __tablename__ = "screen_time_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[str] = mapped_column(String, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    repeat_days: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)


class GlucoseReading(Base):
    __tablename__ = "glucose_readings"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reading_mgdl: Mapped[int] = mapped_column(Integer, nullable=False)
    context_type: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class DailyPlan(Base):
    __tablename__ = "daily_plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    plan_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

class SensorActivity(Base):
    __tablename__ = "sensor_activity"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    steps: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    intensity: Mapped[str] = mapped_column(String, nullable=False)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_accel_magnitude: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    peak_accel_magnitude: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    avg_rotation_rate: Mapped[Optional[float]] = mapped_column(Numeric(6, 3))
    estimated_distance_meters: Mapped[Optional[int]] = mapped_column(Integer)
    calories_estimated: Mapped[Optional[int]] = mapped_column(Integer)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class HabitCompletion(Base):
    __tablename__ = "habit_completions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    habit_key: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="user")
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

class Hydration(Base):
    __tablename__ = "hydration_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount_ml: Mapped[int] = mapped_column(Integer, nullable=False)
    beverage_type: Mapped[str] = mapped_column(String, nullable=False, default="water")
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class BodyMeasurement(Base):
    __tablename__ = "body_measurements"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    body_fat_percentage: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    muscle_mass_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    waist_circumference_cm: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class VitalSign(Base):
    __tablename__ = "vital_signs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    heart_rate_bpm: Mapped[Optional[int]] = mapped_column(Integer)
    blood_pressure_systolic: Mapped[Optional[int]] = mapped_column(Integer)
    blood_pressure_diastolic: Mapped[Optional[int]] = mapped_column(Integer)
    body_temperature_celsius: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    blood_oxygen_percentage: Mapped[Optional[int]] = mapped_column(Integer)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class MentalWellness(Base):
    __tablename__ = "mental_wellness_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mood_score: Mapped[int] = mapped_column(Integer, nullable=False)
    stress_level: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

class Medication(Base):
    __tablename__ = "medication_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    dosage: Mapped[str] = mapped_column(String, nullable=False)
    taken: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    taken_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
