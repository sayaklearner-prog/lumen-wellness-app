from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.api.dependencies import get_db_session
from app.models.wellness import Reminder
from app.schemas.wellness import ReminderCreate, ReminderResponse, ReminderUpdate

router = APIRouter(tags=["reminders"])

@router.get("/reminders", response_model=List[ReminderResponse])
async def list_reminders(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(Reminder).order_by(Reminder.created_at.desc()))
    return result.scalars().all()

@router.post("/reminders", response_model=ReminderResponse)
async def create_reminder(
    reminder: ReminderCreate,
    db: AsyncSession = Depends(get_db_session)
):
    db_reminder = Reminder(**reminder.model_dump())
    db.add(db_reminder)
    await db.commit()
    await db.refresh(db_reminder)
    return db_reminder

@router.put("/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: uuid.UUID,
    update_data: ReminderUpdate,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    db_reminder = result.scalars().first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
        
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_reminder, key, value)
        
    await db.commit()
    await db.refresh(db_reminder)
    return db_reminder

@router.delete("/reminders/{reminder_id}")
async def delete_reminder(
    reminder_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session)
):
    result = await db.execute(select(Reminder).where(Reminder.id == reminder_id))
    db_reminder = result.scalars().first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
        
    await db.delete(db_reminder)
    await db.commit()
    return {"status": "deleted"}
