import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "gobites.db")
print(f"Connecting to {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE orders ADD COLUMN approval_status VARCHAR(50) DEFAULT 'Approved'")
    print("Added approval_status to orders")
except sqlite3.OperationalError as e:
    print(f"orders table alter error: {e}")

try:
    cursor.execute("ALTER TABLE expenses ADD COLUMN approval_status VARCHAR(50) DEFAULT 'Approved'")
    print("Added approval_status to expenses")
except sqlite3.OperationalError as e:
    print(f"expenses table alter error: {e}")

conn.commit()
conn.close()
print("Done")
