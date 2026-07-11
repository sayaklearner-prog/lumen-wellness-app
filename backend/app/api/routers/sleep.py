from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import SleepSessionResponse, SleepSessionCreate, SleepSessionUpdate
from app.models.wellness import SleepEntry

router = APIRouter(prefix="/sleep", tags=["sleep"])

@router.get("", response_model=List[SleepSessionResponse])
async def list_sleep(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(SleepEntry).order_by(SleepEntry.date.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=SleepSessionResponse)
async def create_sleep(sleep: SleepSessionCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_sleep = SleepEntry(**sleep.dict(exclude_unset=True))
    wellness_repo.session.add(new_sleep)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_sleep)
    return new_sleep


@router.put("/{id}", response_model=SleepSessionResponse)
async def update_sleep(id: uuid.UUID, data: SleepSessionUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(SleepSession).where(SleepSession.id == id)
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
async def delete_sleep(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(SleepSession).where(SleepSession.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
