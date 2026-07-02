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

from routers import auth, expenses, inventory, production, products, orders, customers, marketing, reports, suppliers

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
app.include_router(suppliers.router)


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
            existing_admin.role = "owner"
            existing_admin.password_hash = get_password_hash(admin_password)
            print(f"[OK] Owner password updated to match .env and role ensured: {admin_email}")

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
        else:
            existing_staff.password_hash = get_password_hash(staff_password)
            print(f"[OK] Staff password updated to match .env: {staff_email}")

        db.commit()
    finally:
        db.close()


def cleanup_default_packaging():
    """Remove default seeded packaging items that the user didn't create."""
    db = SessionLocal()
    try:
        # Delete default seeded Bags
        db.query(models.InventoryItem).filter(
            models.InventoryItem.category == "Packaging",
            models.InventoryItem.name == "Bags",
            models.InventoryItem.current_quantity == 100.0,
            models.InventoryItem.unit_cost == 0.25
        ).delete(synchronize_session=False)

        # Delete default seeded Stickers
        db.query(models.InventoryItem).filter(
            models.InventoryItem.category == "Packaging",
            models.InventoryItem.name == "Stickers",
            models.InventoryItem.current_quantity == 1000.0,
            models.InventoryItem.unit_cost == 0.015
        ).delete(synchronize_session=False)

        db.commit()
        print("[OK] Cleaned up default seeded packaging items from inventory.")
    except Exception as e:
        print(f"[Error] Failed to clean up default packaging: {e}")
        db.rollback()
    finally:
        db.close()


def recalculate_all_product_costs():
    """Recalculate total_cost and cost_per_piece for all products based on their recipes."""
    db = SessionLocal()
    try:
        products = db.query(models.Product).all()
        for product in products:
            total_recipe_cost = 0.0
            has_recipe = False
            for ri in product.recipe_ingredients:
                inv_item = ri.inventory_item
                if inv_item:
                    has_recipe = True
                    total_recipe_cost += ri.quantity_per_piece * (inv_item.unit_cost or 0.0)
            
            if has_recipe:
                product.total_cost = total_recipe_cost
                product.cost_per_piece = total_recipe_cost / (product.pieces_count or 1)
            else:
                product.total_cost = product.pieces_count * product.cost_per_piece
            
            product.packaging_cost = 0.0
            product.profit = product.selling_price - product.total_cost
            product.profit_margin = (product.profit / product.selling_price * 100) if product.selling_price > 0 else 0.0
        db.commit()
        print("[OK] Recalculated and repaired all product costs in database.")
    except Exception as e:
        print(f"[Error] Failed to recalculate product costs: {e}")
        db.rollback()
    finally:
        db.close()


@app.on_event("startup")
def startup_event():
    seed_users()
    cleanup_default_packaging()
    recalculate_all_product_costs()
    print("[GoBites] Manager API is running!")


@app.get("/")
def root():
    return {"message": "GoBites Manager API v1.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}
