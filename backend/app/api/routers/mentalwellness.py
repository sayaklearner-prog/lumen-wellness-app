from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import MentalWellnessResponse, MentalWellnessCreate, MentalWellnessUpdate
from app.models.wellness import MentalWellness

router = APIRouter(prefix="/mentalwellness", tags=["mentalwellness"])

@router.get("", response_model=List[MentalWellnessResponse])
async def list_mental_wellness(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(MentalWellness).order_by(MentalWellness.logged_at.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=MentalWellnessResponse)
async def create_mental_wellness(wellness: MentalWellnessCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_wellness = MentalWellness(**wellness.dict(exclude_unset=True))
    wellness_repo.session.add(new_wellness)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_wellness)
    return new_wellness


@router.put("/{id}", response_model=MentalWellnessResponse)
async def update_mentalwellness(id: uuid.UUID, data: MentalWellnessUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(MentalWellness).where(MentalWellness.id == id)
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
async def delete_mentalwellness(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(MentalWellness).where(MentalWellness.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
