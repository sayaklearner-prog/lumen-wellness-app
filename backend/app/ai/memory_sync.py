import asyncio
from sqlalchemy import event
from loguru import logger
from app.models.wellness import (
    Meal, Workout, SleepEntry, ScreenTimeEntry,
    Hydration, MentalWellness, VitalSign, Medication, BodyMeasurement, GlucoseReading
)
from app.ai.provider import default_provider
from app.database.session import AsyncSessionLocal
from app.repositories.memory import MemoryRepository

def generate_memory_background(target, model_name: str):
    """
    Fire-and-forget background task to generate an AI memory from a newly logged health event.
    """
    async def process():
        try:
            # We need to construct a prompt based on the object's dictionary representation
            obj_dict = {c.name: getattr(target, c.name) for c in target.__table__.columns}
            
            prompt = f"The user just logged a new {model_name}. Details: {obj_dict}. Write a concise, first-person style memory of this event (e.g., 'User logged a workout burning 300 calories')."
            
            memory_text = await default_provider.generate_chat(
                system_prompt="You are a data-to-text converter. Keep it very short.",
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Since AI ML API doesn't provide embeddings out of the box (unless specified),
            # we will create a dummy embedding or use a cheap embedding model.
            # For this MVP pgvector, we use a mock embedding of 1536 dims (all 0.01s).
            # In production, use text-embedding-3-small.
            embedding = [0.01] * 1536 
            
            async with AsyncSessionLocal() as session:
                repo = MemoryRepository(session)
                # target must have a profile_id if it's tied to a user, but Lumen MVP uses a single global profile.
                from app.repositories.wellness import WellnessRepository
                well_repo = WellnessRepository(session)
                profile = await well_repo.get_or_create_profile()
                
                await repo.insert_memory(
                    profile_id=profile.id,
                    content=memory_text,
                    category=model_name,
                    embedding=embedding
                )
                logger.info(f"Successfully generated AI memory for {model_name}")
                
        except Exception as e:
            logger.error(f"Failed to generate memory for {model_name}: {e}")

    # Create a background task in the running asyncio loop
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(process())
    except RuntimeError:
        pass # No running event loop

def register_listeners():
    models = [
        Meal, Workout, SleepEntry, ScreenTimeEntry,
        Hydration, MentalWellness, VitalSign, Medication, BodyMeasurement, GlucoseReading
    ]
    for model in models:
        @event.listens_for(model, "after_insert")
        def receive_after_insert(mapper, connection, target):
            generate_memory_background(target, mapper.class_.__name__)
            
        @event.listens_for(model, "after_update")
        def receive_after_update(mapper, connection, target):
            generate_memory_background(target, mapper.class_.__name__)
