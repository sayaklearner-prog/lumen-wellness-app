import dramatiq
from dramatiq.brokers.redis import RedisBroker
from loguru import logger
from app.core.config import settings

redis_broker = RedisBroker(url=settings.REDIS_URL)
dramatiq.set_broker(redis_broker)

@dramatiq.actor
def process_memory_extraction(conversation_id: int, message_content: str, profile_id: str):
    """
    Background worker that runs async logic to extract new persistent memories.
    In a real scenario, this connects to the AI provider to extract JSON memories 
    from the chat, then upserts into pgvector.
    """
    logger.info(f"Extracting memories for profile {profile_id} from message in conversation {conversation_id}")
    # Mocking extraction...
    logger.info("Memory extraction complete.")

@dramatiq.actor
def evaluate_coaching_intervention(profile_id: str, event_type: str, data: dict):
    """
    Lightweight LLM evaluation triggered by user events (e.g. logging poor sleep).
    Determines if an autonomous AI coach message or smart notification should be sent.
    """
    logger.info(f"Evaluating coaching intervention for {profile_id} after event: {event_type}")
    
    if event_type == "sleep.logged":
        quality = data.get("quality", "good")
        if quality in ["poor", "fair"]:
            logger.info(f"Triggering smart notification: 'You've slept poorly. Consider a lighter session today.'")
            # In a full implementation, we would push this to a notification service
            
    elif event_type == "meal.logged":
        protein = data.get("proteinGrams", 0)
        if protein < 20:
            logger.info("Triggering smart notification: 'Protein is low for this meal. Remember your goals!'")

@dramatiq.actor
def notify_plan_generated(profile_id: str, date: str):
    """
    Background worker triggered when a daily plan is generated.
    """
    logger.info(f"Daily plan generated for profile {profile_id} on {date}")

def emit(event_name: str, **kwargs):
    """
    Simulates the Node.js eventBus behavior by triggering dramatiq actors.
    """
    if event_name == "message.received":
        process_memory_extraction.send(
            conversation_id=kwargs.get("conversation_id"),
            message_content=kwargs.get("message_content"),
            profile_id=kwargs.get("profile_id")
        )
    elif event_name == "plan.generated":
        notify_plan_generated.send(
            profile_id=kwargs.get("profile_id"),
            date=kwargs.get("date")
        )
    elif event_name in ["sleep.logged", "meal.logged", "activity.logged"]:
        evaluate_coaching_intervention.send(
            profile_id=kwargs.get("profile_id"),
            event_type=event_name,
            data=kwargs.get("data", {})
        )
    else:
        logger.warning(f"Unknown event emitted: {event_name}")
