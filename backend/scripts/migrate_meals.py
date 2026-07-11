import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "..", "lumen.db")

def migrate():
    print(f"Checking database at {db_path} for meal vitamins migration...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check columns
    cursor.execute("PRAGMA table_info(meals)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Current columns in 'meals':", columns)
    
    # Alter table if vitamins column is missing
    if "vitamins" not in columns:
        print("Adding column 'vitamins' to 'meals' table...")
        cursor.execute("ALTER TABLE meals ADD COLUMN vitamins TEXT")
        
    conn.commit()
    conn.close()
    print("Migration checking complete!")

if __name__ == "__main__":
    migrate()
