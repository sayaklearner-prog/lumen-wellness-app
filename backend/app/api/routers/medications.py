from fastapi import APIRouter, Depends, HTTPException
import uuid
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import MedicationResponse, MedicationCreate, MedicationUpdate
from app.models.wellness import Medication

router = APIRouter(prefix="/medications", tags=["medications"])

@router.get("", response_model=List[MedicationResponse])
async def list_medications(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Medication).order_by(Medication.scheduled_for.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=MedicationResponse)
async def create_medication(medication: MedicationCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_medication = Medication(**medication.dict(exclude_unset=True))
    wellness_repo.session.add(new_medication)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_medication)
    return new_medication


@router.put("/{id}", response_model=MedicationResponse)
async def update_medications(id: uuid.UUID, data: MedicationUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Medication).where(Medication.id == id)
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
async def delete_medications(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Medication).where(Medication.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
