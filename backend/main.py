from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Custom simple parser for .env files without python-dotenv dependency
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip()

load_env()

from database import engine, SessionLocal
import models
from auth import get_password_hash

# Import routers
from routers import auth, expenses, inventory, production, products, orders, customers, marketing, reports

# Create all tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GoBites Manager API",
    description="ERP System for GoBites Chocolate Business",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:3000", 
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(inventory.router)
app.include_router(production.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(customers.router)
app.include_router(marketing.router)
app.include_router(reports.router)


def seed_users():
    """Create default admin and staff users if not exists."""
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@gobites.co")
        admin_password = os.getenv("ADMIN_PASSWORD", "gobites2024")
        staff_email = os.getenv("STAFF_EMAIL", "staff@gobites.co")
        staff_password = os.getenv("STAFF_PASSWORD", "gobites2024")

        # Admin / Owner
        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing_admin:
            admin = models.User(
                name="GoBites Manager",
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                role="owner"
            )
            db.add(admin)
            print(f"[OK] Default owner created: {admin_email}")
        else:
            if existing_admin.role == "admin":
                existing_admin.role = "owner"
                print(f"[OK] Upgraded existing admin to owner: {admin_email}")

        # Staff
        existing_staff = db.query(models.User).filter(models.User.email == staff_email).first()
        if not existing_staff:
            staff = models.User(
                name="GoBites Staff",
                email=staff_email,
                password_hash=get_password_hash(staff_password),
                role="staff"
            )
            db.add(staff)
            print(f"[OK] Default staff created: {staff_email}")

        db.commit()
    finally:
        db.close()


def seed_packaging():
    """Ensure default packaging items exist in the database."""
    db = SessionLocal()
    try:
        from sqlalchemy import func
        # Check Bags
        bags = db.query(models.InventoryItem).filter(
            models.InventoryItem.category == "Packaging",
            func.lower(models.InventoryItem.name).in_(["bag", "bags"])
        ).first()
        if not bags:
            db.add(models.InventoryItem(
                name="Bags",
                category="Packaging",
                current_quantity=100.0,
                unit="pcs",
                unit_cost=0.25,
                minimum_quantity=10.0
            ))
            
        # Check Boxes
        boxes = db.query(models.InventoryItem).filter(
            models.InventoryItem.category == "Packaging",
            func.lower(models.InventoryItem.name).in_(["box", "boxes"])
        ).first()
        if not boxes:
            db.add(models.InventoryItem(
                name="Boxes",
                category="Packaging",
                current_quantity=100.0,
                unit="pcs",
                unit_cost=0.30,
                minimum_quantity=10.0
            ))

        # Check Stickers
        stickers = db.query(models.InventoryItem).filter(
            models.InventoryItem.category == "Packaging",
            func.lower(models.InventoryItem.name).in_(["sticker", "stickers"])
        ).first()
        if not stickers:
            db.add(models.InventoryItem(
                name="Stickers",
                category="Packaging",
                current_quantity=1000.0,
                unit="pcs",
                unit_cost=0.015,
                minimum_quantity=50.0
            ))
        db.commit()
    except Exception as e:
        print(f"[Error] Packaging seeding failed: {e}")
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    seed_users()
    seed_packaging()
    print("[GoBites] Manager API is running!")


@app.get("/")
def root():
    return {"message": "GoBites Manager API v1.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
