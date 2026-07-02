from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date, Boolean,
    ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    admin = "admin"
    staff = "staff"

class ExpenseCategory(str, enum.Enum):
    raw_materials = "Raw Materials"
    packaging = "Packaging"
    delivery = "Delivery"
    advertising = "Advertising"
    photography = "Photography"
    equipment = "Equipment"
    tools = "Tools"
    other = "Other"

class PaymentMethod(str, enum.Enum):
    cash = "Cash"
    bank_transfer = "Bank Transfer"
    credit_card = "Credit Card"
    online = "Online"

class InventoryCategory(str, enum.Enum):
    raw_materials = "Raw Materials"
    packaging = "Packaging"
    tools = "Tools"
    other = "Other"

class InventoryStatus(str, enum.Enum):
    ok = "OK"
    low = "Low"
    critical = "Critical"
    expired = "Expired"

class OrderStatus(str, enum.Enum):
    new = "New"
    preparing = "Preparing"
    ready = "Ready"
    with_delivery = "With Delivery"
    delivered = "Delivered"
    cancelled = "Cancelled"

class CustomerType(str, enum.Enum):
    employee = "Employee"
    family = "Family"
    corporate = "Corporate"
    gift = "Gift"
    regular = "Regular"

class CustomerSource(str, enum.Enum):
    instagram = "Instagram"
    tiktok = "TikTok"
    referral = "Referral"
    whatsapp = "WhatsApp"
    friend = "Friend"
    paid_ad = "Paid Ad"

class MarketingPlatform(str, enum.Enum):
    instagram = "Instagram"
    tiktok = "TikTok"
    whatsapp = "WhatsApp"
    facebook = "Facebook"
    google = "Google"
    other = "Other"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(20), default="admin")
    phone = Column(String(50), nullable=True)
    financial_advances = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    quantity = Column(Float, default=1.0)
    unit = Column(String(50))
    total_cost = Column(Float, nullable=False)
    supplier = Column(String(200))
    supplier_branch = Column(String(200))
    payment_method = Column(String(50))
    notes = Column(Text)
    approval_status = Column(String(50), default="Approved")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    created_by = relationship("User")

    @property
    def created_by_name(self):
        return self.created_by.name if self.created_by else "System"


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50))
    current_quantity = Column(Float, default=0.0)
    unit = Column(String(50))
    unit_cost = Column(Float, default=0.0)
    minimum_quantity = Column(Float, default=0.0)
    supplier = Column(String(200))
    supplier_branch = Column(String(200))
    purchase_date = Column(Date)
    expiry_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch_ingredients = relationship("BatchIngredient", back_populates="inventory_item")

    @property
    def status(self):
        if self.current_quantity <= 0:
            return "Critical"
        elif self.current_quantity < self.minimum_quantity:
            return "Low"
        return "OK"


class ProductionBatch(Base):
    __tablename__ = "production_batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String(100), nullable=False, unique=True)
    production_date = Column(Date, nullable=False)
    flavor = Column(String(100))
    total_pieces = Column(Integer, nullable=False)
    raw_material_cost = Column(Float, default=0.0)
    packaging_cost = Column(Float, default=0.0)
    labor_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    cost_per_piece = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Optional link to a product (used when batch was produced via a product recipe)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)

    ingredients = relationship("BatchIngredient", back_populates="batch", cascade="all, delete-orphan")
    product = relationship("Product", foreign_keys=[product_id])


class BatchIngredient(Base):
    __tablename__ = "batch_ingredients"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("production_batches.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity_used = Column(Float, nullable=False)
    unit_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)

    batch = relationship("ProductionBatch", back_populates="ingredients")
    inventory_item = relationship("InventoryItem", back_populates="batch_ingredients")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    pieces_count = Column(Integer, default=0)
    selling_price = Column(Float, nullable=False)
    cost_per_piece = Column(Float, default=0.0)
    packaging_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)
    image_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order_items = relationship("OrderItem", back_populates="product")
    recipe_ingredients = relationship("ProductRecipeIngredient", back_populates="product", cascade="all, delete-orphan")


class ProductRecipeIngredient(Base):
    """Stores how much of each raw-material inventory item is used per piece of a product."""
    __tablename__ = "product_recipe_ingredients"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity_per_piece = Column(Float, nullable=False)  # e.g. 4 (grams per piece)
    input_unit = Column(String(50), nullable=True)     # unit preferred by user

    product = relationship("Product", back_populates="recipe_ingredients")
    inventory_item = relationship("InventoryItem")


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(50))
    area = Column(String(100))
    gender = Column(String(20))
    customer_type = Column(String(50))
    source = Column(String(50))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders = relationship("Order", back_populates="customer")

    @property
    def total_orders(self):
        return sum(1 for o in self.orders if o.status != "Cancelled" and o.approval_status == "Approved")

    @property
    def total_purchases(self):
        return sum(o.total_amount for o in self.orders if o.status != "Cancelled" and o.approval_status == "Approved")

    @property
    def last_order_date(self):
        active = [o.order_date for o in self.orders if o.status != "Cancelled" and o.approval_status == "Approved"]
        return max(active) if active else None


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    order_date = Column(Date, nullable=False)
    status = Column(String(50), default="New")
    subtotal = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    delivery_fee = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    payment_method = Column(String(50))
    net_profit = Column(Float, default=0.0)
    notes = Column(Text)
    boxes_used = Column(Integer, default=0)
    bags_used = Column(Integer, default=0)
    stickers_used = Column(Integer, default=0)
    packaging_cost = Column(Float, default=0.0)
    approval_status = Column(String(50), default="Approved")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    created_by = relationship("User")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, default=0.0)
    estimated_cost = Column(Float, default=0.0)
    profit = Column(Float, default=0.0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    platform = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date)
    budget = Column(Float, default=0.0)
    messages_count = Column(Integer, default=0)
    orders_count = Column(Integer, default=0)
    sales_amount = Column(Float, default=0.0)
    profit_amount = Column(Float, default=0.0)
    roas = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")


class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    phone = Column(String(50))
    location = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    branches = relationship("SupplierBranch", back_populates="supplier", cascade="all, delete-orphan")


class SupplierBranch(Base):
    __tablename__ = "supplier_branches"
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    phone = Column(String(50))
    location = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    supplier = relationship("Supplier", back_populates="branches")
