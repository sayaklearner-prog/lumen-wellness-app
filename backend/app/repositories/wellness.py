from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.wellness import Profile, Meal, Workout, SleepEntry, ScreenTimeEntry, Hydration, MentalWellness, VitalSign, Medication
from datetime import date
import uuid

class WellnessRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_or_create_profile(self) -> Profile:
        stmt = select(Profile).limit(1)
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        
        if not profile:
            profile = Profile(name="Demo User")
            self.session.add(profile)
            await self.session.commit()
            await self.session.refresh(profile)
            
        return profile

    async def get_day_totals(self, target_date: date):
        # Async load meals, workouts, sleep, screentime for the date
        meals_stmt = select(Meal).where(func.date(Meal.logged_at) == target_date)
        workouts_stmt = select(Workout).where(func.date(Workout.logged_at) == target_date)
        sleep_stmt = select(SleepEntry).where(SleepEntry.date == target_date)
        screen_stmt = select(ScreenTimeEntry).where(func.date(ScreenTimeEntry.started_at) == target_date)
        hydration_stmt = select(Hydration).where(func.date(Hydration.logged_at) == target_date)
        mental_stmt = select(MentalWellness).where(func.date(MentalWellness.logged_at) == target_date)
        vitals_stmt = select(VitalSign).where(func.date(VitalSign.logged_at) == target_date)
        meds_stmt = select(Medication).where(func.date(Medication.scheduled_for) == target_date)

        meals_res = await self.session.execute(meals_stmt)
        workouts_res = await self.session.execute(workouts_stmt)
        sleep_res = await self.session.execute(sleep_stmt)
        screen_res = await self.session.execute(screen_stmt)
        hydration_res = await self.session.execute(hydration_stmt)
        mental_res = await self.session.execute(mental_stmt)
        vitals_res = await self.session.execute(vitals_stmt)
        meds_res = await self.session.execute(meds_stmt)

        return {
            "dayMeals": meals_res.scalars().all(),
            "dayWorkouts": workouts_res.scalars().all(),
            "sleepRow": sleep_res.scalars().first(),
            "screenRow": screen_res.scalars().first(),
            "dayHydration": hydration_res.scalars().all(),
            "dayMental": mental_res.scalars().all(),
            "dayVitals": vitals_res.scalars().all(),
            "dayMeds": meds_res.scalars().all(),
        }
