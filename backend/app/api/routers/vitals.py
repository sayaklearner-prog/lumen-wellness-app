from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import VitalSignResponse, VitalSignCreate, VitalSignUpdate
from app.models.wellness import VitalSign

router = APIRouter(prefix="/vitals", tags=["vitals"])

@router.get("", response_model=List[VitalSignResponse])
async def list_vitals(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(VitalSign).order_by(VitalSign.logged_at.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=VitalSignResponse)
async def create_vital(vital: VitalSignCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_vital = VitalSign(**vital.dict(exclude_unset=True))
    wellness_repo.session.add(new_vital)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_vital)
    return new_vital


@router.put("/{id}", response_model=VitalSignResponse)
async def update_vitals(id: uuid.UUID, data: VitalSignUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(VitalSign).where(VitalSign.id == id)
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
async def delete_vitals(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(VitalSign).where(VitalSign.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
