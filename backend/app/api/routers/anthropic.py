from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.dependencies import get_wellness_repo, get_memory_repo
from app.database.session import get_db_session
from app.repositories.wellness import WellnessRepository
from app.repositories.memory import MemoryRepository
from app.schemas.memory import MessageCreate
from app.models.memory import Conversation, Message
from app.ai.agents.router import router_agent
from datetime import datetime
import json
from loguru import logger

router = APIRouter()

@router.get("/anthropic/conversations")
async def list_conversations(db: AsyncSession = Depends(get_db_session)):
    stmt = select(Conversation).order_by(Conversation.created_at.desc())
    result = await db.execute(stmt)
    convos = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "createdAt": c.created_at.isoformat(),
            "updatedAt": c.created_at.isoformat()
        } for c in convos
    ]

@router.post("/anthropic/conversations")
async def create_conversation(data: dict, db: AsyncSession = Depends(get_db_session)):
    new_convo = Conversation(title=data.get("title", "New Conversation"))
    db.add(new_convo)
    await db.commit()
    await db.refresh(new_convo)
    return {
        "id": new_convo.id,
        "title": new_convo.title,
        "createdAt": new_convo.created_at.isoformat(),
        "updatedAt": new_convo.created_at.isoformat()
    }

@router.get("/anthropic/conversations/{conversation_id}")
async def get_conversation(conversation_id: int, db: AsyncSession = Depends(get_db_session)):
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    c = result.scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": c.id,
        "title": c.title,
        "createdAt": c.created_at.isoformat(),
        "updatedAt": c.created_at.isoformat()
    }

@router.delete("/anthropic/conversations/{conversation_id}")
async def delete_conversation(conversation_id: int, db: AsyncSession = Depends(get_db_session)):
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await db.execute(stmt)
    c = result.scalars().first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(c)
    await db.commit()
    return {"status": "deleted"}

@router.get("/anthropic/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: int, db: AsyncSession = Depends(get_db_session)):
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    result = await db.execute(stmt)
    msgs = result.scalars().all()
    return [
        {
            "id": m.id,
            "conversationId": m.conversation_id,
            "role": m.role,
            "content": m.content,
            "createdAt": m.created_at.isoformat()
        } for m in msgs
    ]

@router.post("/anthropic/conversations/{conversation_id}/messages")
async def send_anthropic_message(
    conversation_id: str,
    message: MessageCreate,
    wellness_repo: WellnessRepository = Depends(get_wellness_repo),
    memory_repo: MemoryRepository = Depends(get_memory_repo),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Streaming endpoint that utilizes PostgreSQL conversations, pgvector memory, and AI Provider.
    """
    convo_id = int(conversation_id)
    
    # Save user message to DB
    user_msg = Message(conversation_id=convo_id, role="user", content=message.content)
    db.add(user_msg)
    await db.commit()
    
    profile = await wellness_repo.get_or_create_profile()
    today_totals = await wellness_repo.get_day_totals(datetime.utcnow().date())
    
    # Retrieve relevant memories via pgvector
    # First, mock a basic embedding for the query since we don't have text-embedding-3-small locally
    query_embedding = [0.01] * 1536
    relevant_memories = await memory_repo.find_similar_memories(embedding=query_embedding, limit=5)
    
    recent_memories = [m[0].content for m in relevant_memories]

    # Format today_totals into a readable text format for AI prompt
    meals_text = ", ".join([f"{m.name} ({m.calories} kcal, {m.protein_grams}g protein)" for m in today_totals["dayMeals"]]) or "None"
    workouts_text = ", ".join([f"{w.type} ({w.duration_minutes} mins, {w.calories_burned} kcal, {w.steps} steps, distance: {getattr(w, 'distance_km', 'N/A')} km, heart rate: {getattr(w, 'avg_heart_rate', 'N/A')} bpm)" for w in today_totals["dayWorkouts"]]) or "None"
    hydration_ml = sum(h.amount_ml for h in today_totals["dayHydration"])
    sleep_text = f"{today_totals['sleepRow'].duration_hours} hrs ({today_totals['sleepRow'].quality})" if today_totals["sleepRow"] else "None"
    mood_text = ", ".join([f"Score: {m.mood_score}/10" for m in today_totals["dayMental"]]) or "None"
    vitals_text = ", ".join([f"HR: {v.heart_rate_bpm} bpm" for v in today_totals["dayVitals"]]) or "None"
    meds_text = ", ".join([f"{m.name} ({m.dosage})" for m in today_totals["dayMeds"]]) or "None"
    
    today_summary = f"Meals: {meals_text}; Workouts: {workouts_text}; Hydration: {hydration_ml}ml; Sleep: {sleep_text}; Mood: {mood_text}; Vitals: {vitals_text}; Meds: {meds_text}"

    context = {
        "name": profile.name,
        "mode": profile.mode,
        "today_totals": today_summary,
        "recent_memories": recent_memories 
    }

    # Extract conversation history for the AI provider
    stmt = select(Message).where(Message.conversation_id == convo_id).order_by(Message.created_at.asc())
    result = await db.execute(stmt)
    all_msgs = result.scalars().all()
    history = [{"role": m.role, "content": m.content} for m in all_msgs]

    async def event_generator():
        full_response = ""
        try:
            async for token in router_agent.route_and_process(message.content, context, history):
                full_response += token
                yield f"data: {json.dumps({'content': token})}\n\n"
            
            # Save AI response to DB
            ai_msg = Message(conversation_id=convo_id, role="assistant", content=full_response)
            db.add(ai_msg)
            await db.commit()
            
            yield 'data: {"done": true}\n\n'
        except Exception as e:
            logger.error(f"Streaming failed: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
