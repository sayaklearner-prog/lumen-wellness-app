import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "lumen.db")

def migrate():
    print(f"Checking database at {db_path} for migration...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check columns
    cursor.execute("PRAGMA table_info(workouts)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Current columns in 'workouts':", columns)
    
    # Alter table if columns are missing
    if "distance_km" not in columns:
        print("Adding column 'distance_km' to 'workouts' table...")
        cursor.execute("ALTER TABLE workouts ADD COLUMN distance_km REAL")
    
    if "avg_heart_rate" not in columns:
        print("Adding column 'avg_heart_rate' to 'workouts' table...")
        cursor.execute("ALTER TABLE workouts ADD COLUMN avg_heart_rate INTEGER")
        
    if "notes" not in columns:
        print("Adding column 'notes' to 'workouts' table...")
        cursor.execute("ALTER TABLE workouts ADD COLUMN notes TEXT")
        
    conn.commit()
    conn.close()
    print("Migration checking complete!")

if __name__ == "__main__":
    migrate()
