from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import ProfileResponse, ProfileCreate

router = APIRouter(prefix="/profile", tags=["profiles"])

@router.get("", response_model=ProfileResponse)
async def get_my_profile(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    profile = await wellness_repo.get_or_create_profile()
    return profile

@router.patch("", response_model=ProfileResponse)
async def update_my_profile(profile_update: ProfileCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    # Basic implementation
    profile = await wellness_repo.get_or_create_profile()
    for key, value in profile_update.dict(exclude_unset=True).items():
        setattr(profile, key, value)
    
    wellness_repo.session.add(profile)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(profile)
    return profile
