import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.wellness import Hydration
from app.core.config import settings
from uuid import uuid4
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath('backend'))

async def test():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    async with SessionLocal() as session:
        try:
            h = Hydration(id=uuid4(), amount_ml=500, beverage_type="water")
            session.add(h)
            await session.commit()
            print("Successfully added Hydration")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test())
