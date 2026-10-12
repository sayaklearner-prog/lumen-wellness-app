from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import date, datetime
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import WearableSyncResponse, WearableSyncCreate
from app.models.wellness import WearableSync, Workout, SleepEntry, VitalSign

router = APIRouter(prefix="/wearables", tags=["wearables"])

@router.get("/latest", response_model=Optional[WearableSyncResponse])
async def get_latest_wearable_sync(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    """
    Retrieve the most recently synchronized wearable telemetry snapshot.
    """
    stmt = select(WearableSync).order_by(WearableSync.synced_at.desc()).limit(1)
    result = await wellness_repo.session.execute(stmt)
    latest = result.scalar_one_or_none()
    return latest

@router.get("/history", response_model=List[WearableSyncResponse])
async def list_wearable_sync_history(
    limit: int = 50,
    wellness_repo: WellnessRepository = Depends(get_wellness_repo)
):
    """
    Retrieve historical wearable synchronization sessions.
    """
    stmt = select(WearableSync).order_by(WearableSync.synced_at.desc()).limit(limit)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("/sync", response_model=WearableSyncResponse)
async def sync_wearable_telemetry(
    data: WearableSyncCreate,
    wellness_repo: WellnessRepository = Depends(get_wellness_repo)
):
    """
    Ingest telemetry synchronized from an OpenStrap Edge compatible wearable.
    Automatically:
    1. Persists raw wearable telemetry record.
    2. Logs a Workout entry for steps and active calories.
    3. Logs a SleepEntry for sleep duration and sleep architecture stages.
    4. Logs a VitalSign entry for heart rate, blood oxygen (SpO2), and skin temperature.
    """
    sync_record = WearableSync(
        device_id=data.device_id,
        device_name=data.device_name,
        brand=data.brand,
        model=data.model,
        steps=data.steps,
        active_calories=data.active_calories,
        total_calories=data.total_calories,
        distance_km=data.distance_km,
        sleep_duration_hours=data.sleep_duration_hours,
        sleep_score=data.sleep_score,
        deep_sleep_percent=data.deep_sleep_percent,
        rem_sleep_percent=data.rem_sleep_percent,
        heart_rate=data.heart_rate,
        resting_heart_rate=data.resting_heart_rate,
        hrv_ms=data.hrv_ms,
        spo2_percent=data.spo2_percent,
        skin_temperature_c=data.skin_temperature_c,
        battery_level=data.battery_level,
        firmware_revision=data.firmware_revision,
        synced_at=datetime.utcnow()
    )
    wellness_repo.session.add(sync_record)

    # 1. Integrate Activity / Workout if steps or active calories are present
    if data.steps > 0 or data.active_calories > 0:
        duration_est = max(30, int(data.steps / 100)) if data.steps > 0 else 30
        workout = Workout(
            type="walk" if data.steps > 0 else "other",
            duration_minutes=duration_est,
            calories_burned=data.active_calories if data.active_calories > 0 else int(data.steps * 0.04),
            steps=data.steps,
            intensity="moderate",
            source=f"wearable_{data.brand}",
            distance_km=data.distance_km,
            avg_heart_rate=data.heart_rate or data.resting_heart_rate,
            notes=f"Synced from {data.device_name} ({data.brand.upper()})"
        )
        wellness_repo.session.add(workout)

    # 2. Integrate Sleep if sleep duration is reported
    if data.sleep_duration_hours and data.sleep_duration_hours > 0:
        today = date.today()
        deep_pct = data.deep_sleep_percent if data.deep_sleep_percent else 20
        deep_hrs = round(float(data.sleep_duration_hours) * (deep_pct / 100.0), 2)
        score = data.sleep_score if data.sleep_score else 80
        quality = "optimal" if score >= 85 else "good" if score >= 70 else "fair"

        # Check if sleep entry exists for today, update or create
        stmt = select(SleepEntry).where(SleepEntry.date == today)
        existing_sleep = (await wellness_repo.session.execute(stmt)).scalar_one_or_none()
        if existing_sleep:
            existing_sleep.duration_hours = data.sleep_duration_hours
            existing_sleep.quality = quality
            existing_sleep.deep_sleep_hours = deep_hrs
            existing_sleep.notes = f"Synced from {data.device_name} (Score: {score})"
        else:
            sleep_entry = SleepEntry(
                date=today,
                duration_hours=data.sleep_duration_hours,
                quality=quality,
                bedtime="23:00",
                wake_time="07:00",
                deep_sleep_hours=deep_hrs,
                notes=f"Synced from {data.device_name} (Score: {score})"
            )
            wellness_repo.session.add(sleep_entry)

    # 3. Integrate Vitals if heart rate or SpO2 is reported
    if data.heart_rate or data.spo2_percent:
        vital = VitalSign(
            heart_rate_bpm=data.heart_rate,
            blood_oxygen_percentage=data.spo2_percent,
            body_temperature_celsius=data.skin_temperature_c,
            logged_at=datetime.utcnow()
        )
        wellness_repo.session.add(vital)

    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(sync_record)
    return sync_record
