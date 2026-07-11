from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import ScreenTimeEntryResponse, ScreenTimeEntryCreate, ScreenTimeEntryUpdate
from app.models.wellness import ScreenTimeEntry

router = APIRouter(prefix="/screentime", tags=["screentime"])

@router.get("", response_model=List[ScreenTimeEntryResponse])
async def list_screentime(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(ScreenTimeEntry).order_by(ScreenTimeEntry.started_at.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=ScreenTimeEntryResponse)
async def create_screentime(screentime: ScreenTimeEntryCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_screentime = ScreenTimeEntry(**screentime.dict(exclude_unset=True))
    wellness_repo.session.add(new_screentime)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_screentime)
    return new_screentime


@router.put("/{id}", response_model=ScreenTimeEntryResponse)
async def update_screentime(id: uuid.UUID, data: ScreenTimeEntryUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(ScreenTimeEntry).where(ScreenTimeEntry.id == id)
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
async def delete_screentime(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(ScreenTimeEntry).where(ScreenTimeEntry.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
