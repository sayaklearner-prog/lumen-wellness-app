from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db_session
from app.repositories.wellness import WellnessRepository
from app.repositories.memory import MemoryRepository

def get_wellness_repo(session: AsyncSession = Depends(get_db_session)) -> WellnessRepository:
    return WellnessRepository(session)

def get_memory_repo(session: AsyncSession = Depends(get_db_session)) -> MemoryRepository:
    return MemoryRepository(session)
