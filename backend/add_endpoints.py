import os

files_to_modify = [
    'sleep.py', 'screentime.py', 'hydration.py', 'mentalwellness.py', 
    'medications.py', 'vitals.py', 'glucose.py', 'bodymeasurements.py', 
    'workouts.py', 'meals.py'
]

mapping = {
    'sleep.py': ('SleepSession', 'SleepSessionResponse', 'SleepSessionUpdate'),
    'screentime.py': ('ScreenTimeEntry', 'ScreenTimeEntryResponse', 'ScreenTimeEntryUpdate'),
    'hydration.py': ('Hydration', 'HydrationResponse', 'HydrationUpdate'),
    'mentalwellness.py': ('MentalWellness', 'MentalWellnessResponse', 'MentalWellnessUpdate'),
    'medications.py': ('Medication', 'MedicationResponse', 'MedicationUpdate'),
    'vitals.py': ('VitalSign', 'VitalSignResponse', 'VitalSignUpdate'),
    'glucose.py': ('GlucoseReading', 'GlucoseReadingResponse', 'GlucoseReadingUpdate'),
    'bodymeasurements.py': ('BodyMeasurement', 'BodyMeasurementResponse', 'BodyMeasurementUpdate'),
    'workouts.py': ('Workout', 'WorkoutResponse', 'WorkoutUpdate'),
    'meals.py': ('Meal', 'MealResponse', 'MealUpdate'),
}

routers_dir = '/Users/mackbookpro/Lumen AI/lumen-wellness-app/backend/app/api/routers'

for filename in files_to_modify:
    filepath = os.path.join(routers_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    model, response, update = mapping[filename]
    
    # Add HTTPException and uuid if missing
    if 'HTTPException' not in content:
        content = content.replace('from fastapi import APIRouter, Depends', 'from fastapi import APIRouter, Depends, HTTPException\nimport uuid')
    
    # Import update schema
    import_start = content.find('from app.schemas.wellness import ')
    if import_start != -1:
        import_end = content.find('\n', import_start)
        existing_imports = content[import_start:import_end]
        if update not in existing_imports:
            content = content.replace(existing_imports, existing_imports + f', {update}')

    # Add PUT and DELETE endpoints
    append_str = f"""
@router.put("/{{id}}", response_model={response})
async def update_item(id: uuid.UUID, data: {update}, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select({model}).where({model}.id == id)
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

@router.delete("/{{id}}")
async def delete_item(id: uuid.UUID, wellness_repo: WellnessRepository = Depends(get_wellness_repo)):
    stmt = select({model}).where({model}.id == id)
    result = await wellness_repo.session.execute(stmt)
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    await wellness_repo.session.delete(item)
    await wellness_repo.session.commit()
    return {{"status": "ok"}}
"""
    if 'update_item' not in content:
        content += "\n" + append_str
        
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Updated {filename}")
