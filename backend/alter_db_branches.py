import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "gobites.db")
print(f"Connecting to {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE expenses ADD COLUMN supplier_branch VARCHAR(200)")
    print("Added supplier_branch to expenses")
except sqlite3.OperationalError as e:
    print(f"expenses table alter error: {e}")

try:
    cursor.execute("ALTER TABLE inventory_items ADD COLUMN supplier_branch VARCHAR(200)")
    print("Added supplier_branch to inventory_items")
except sqlite3.OperationalError as e:
    print(f"inventory_items table alter error: {e}")

conn.commit()
conn.close()
print("Database schema updated successfully!")
