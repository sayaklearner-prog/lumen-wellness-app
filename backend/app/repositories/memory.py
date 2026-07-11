from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, literal
from app.models.memory import Memory
import uuid
from typing import List

class MemoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def insert_memory(self, profile_id: uuid.UUID, content: str, category: str, embedding: List[float]):
        new_memory = Memory(
            profile_id=profile_id,
            content=content,
            category=category,
            embedding=embedding
        )
        self.session.add(new_memory)
        await self.session.commit()
        await self.session.refresh(new_memory)
        return new_memory

    async def find_similar_memories(self, embedding: List[float], limit: int = 5, threshold: float = 0.75):
        engine_url = str(self.session.bind.url) if self.session.bind else ""
        if "sqlite" in engine_url:
            stmt = select(Memory, literal(1.0).label("similarity")).order_by(Memory.created_at.desc()).limit(limit)
            result = await self.session.execute(stmt)
            return result.all()

        # pgvector cosine distance: embedding.cosine_distance(target) -> lower is more similar
        # similarity = 1 - distance
        stmt = select(
            Memory,
            (1 - Memory.embedding.cosine_distance(embedding)).label("similarity")
        ).where(
            (1 - Memory.embedding.cosine_distance(embedding)) > threshold
        ).order_by(
            Memory.embedding.cosine_distance(embedding)
        ).limit(limit)

        result = await self.session.execute(stmt)
        # Returns tuples of (Memory, similarity_score)
        return result.all()
