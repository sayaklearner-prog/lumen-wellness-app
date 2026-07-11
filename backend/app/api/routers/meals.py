import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from typing import List
from app.api.dependencies import get_wellness_repo
from app.repositories.wellness import WellnessRepository
from app.schemas.wellness import MealResponse, MealCreate, MealUpdate
from app.models.wellness import Meal

router = APIRouter(prefix="/meals", tags=["meals"])

@router.get("", response_model=List[MealResponse])
async def list_meals(wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Meal).order_by(Meal.logged_at.desc()).limit(50)
    result = await wellness_repo.session.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=MealResponse)
async def create_meal(meal: MealCreate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    new_meal = Meal(**meal.dict())
    wellness_repo.session.add(new_meal)
    await wellness_repo.session.commit()
    await wellness_repo.session.refresh(new_meal)
    return new_meal

@router.delete("/{meal_id}")
async def delete_meal(meal_id: str, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Meal).where(Meal.id == meal_id)
    result = await wellness_repo.session.execute(stmt)
    meal = result.scalars().first()
    if meal:
        await wellness_repo.session.delete(meal)
        await wellness_repo.session.commit()
    return {"success": True}

@router.post("/recognize")
async def recognize_food(body: dict):
    """
    Simulates advanced Computer Vision capabilities to recognize food from images.
    Returns portion estimation, macro estimation, confidence scoring, and vitamin content.
    """
    hint = body.get("hint", "")
    image = body.get("image", "")  # Base64 encoded image string
    
    system_prompt = "You are an expert AI Nutritionist. Analyze the user's food description or image and estimate the nutritional value including vitamins."
    
    user_prompt_text = f"""
    Analyze this food. Hint/description from user: "{hint}".
    Estimate the serving size, calories, protein, carbs, fats, and vitamin content.
    
    Return ONLY a JSON object matching this structure:
    {{
      "name": "Formatted name of the dish",
      "confidence": 0.95,
      "mealType": "breakfast" | "lunch" | "dinner" | "snack",
      "calories": 450,
      "proteinGrams": 25,
      "carbsGrams": 50,
      "fatGrams": 12,
      "vitamins": "Vitamin C: 15mg, Calcium: 120mg, Vitamin A: 10%",
      "items": [
        {{
          "name": "Component name (e.g. Rice, Grilled Chicken)",
          "quantity": "1 serving",
          "calories": 250,
          "proteinGrams": 20,
          "carbsGrams": 30,
          "fatGrams": 5,
          "confidence": 0.95
        }}
      ],
      "notes": "Brief nutritional advice or scanning explanation."
    }}
    """
    
    # Construct message content
    if image:
        # Multimodal message for Vision API
        content = [
            {"type": "text", "text": user_prompt_text},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image}"}}
        ]
    else:
        content = user_prompt_text

    from app.ai.provider import default_provider
    from loguru import logger
    import json
    
    try:
        response_text = await default_provider.generate_chat(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": content}],
            model="gpt-4o-mini",
            json_mode=True
        )
        data = json.loads(response_text)
        return data
    except Exception as e:
        logger.error(f"Failed to generate nutrition scan: {e}")
        # Fallback if AI fails
        return {
            "name": hint or "Unknown Food",
            "confidence": 0.5,
            "mealType": "snack",
            "calories": 300,
            "proteinGrams": 10,
            "carbsGrams": 40,
            "fatGrams": 10,
            "vitamins": "Vitamin C: 5mg, Vitamin B6: 5%",
            "items": [],
            "notes": f"AI scan explanation: {str(e)}."
        }


@router.put("/{id}", response_model=MealResponse)
async def update_meals(id: uuid.UUID, data: MealUpdate, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Meal).where(Meal.id == id)
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
async def delete_meals(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select(Meal).where(Meal.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {"status": "ok"}
