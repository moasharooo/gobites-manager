from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ─── Expense ──────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    date: date
    name: str
    category: str
    quantity: float = 1.0
    unit: Optional[str] = None
    total_cost: float
    supplier: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class ExpenseUpdate(ExpenseCreate):
    pass

class ExpenseOut(ExpenseCreate):
    id: int
    approval_status: str
    created_by_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Inventory ────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    name: str
    category: Optional[str] = None
    current_quantity: float = 0.0
    unit: Optional[str] = None
    unit_cost: float = 0.0
    minimum_quantity: float = 0.0
    supplier: Optional[str] = None
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None

class InventoryItemUpdate(InventoryItemCreate):
    pass

class InventoryItemOut(InventoryItemCreate):
    id: int
    status: str
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Production ───────────────────────────────────────────────────────────────

class BatchIngredientCreate(BaseModel):
    inventory_item_id: int
    quantity_used: float
    unit_cost: float = 0.0
    total_cost: float = 0.0

class BatchIngredientOut(BatchIngredientCreate):
    id: int
    inventory_item_name: Optional[str] = None
    class Config:
        from_attributes = True

class ProductionBatchCreate(BaseModel):
    batch_name: str
    production_date: date
    flavor: Optional[str] = None
    total_pieces: int
    packaging_cost: float = 0.0
    labor_cost: float = 0.0
    notes: Optional[str] = None
    ingredients: List[BatchIngredientCreate] = []
    product_id: Optional[int] = None  # if set and ingredients is empty, auto-expand recipe

class ProductionBatchOut(BaseModel):
    id: int
    batch_name: str
    production_date: date
    flavor: Optional[str]
    total_pieces: int
    raw_material_cost: float
    packaging_cost: float
    labor_cost: float
    total_cost: float
    cost_per_piece: float
    notes: Optional[str]
    created_at: datetime
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    ingredients: List[BatchIngredientOut] = []
    remaining_pieces: Optional[int] = None
    class Config:
        from_attributes = True


# ─── Product ──────────────────────────────────────────────────────────────────

class RecipeIngredientCreate(BaseModel):
    inventory_item_id: int
    quantity_per_piece: float
    input_unit: Optional[str] = None  # e.g. 'g' or 'kg'

class RecipeIngredientOut(RecipeIngredientCreate):
    id: int
    inventory_item_name: Optional[str] = None
    inventory_item_unit: Optional[str] = None
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pieces_count: int
    selling_price: float
    cost_per_piece: float = 0.0
    packaging_cost: float = 0.0
    image_url: Optional[str] = None
    is_active: bool = True
    recipe: List[RecipeIngredientCreate] = []

class ProductUpdate(ProductCreate):
    pass

class ProductOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    pieces_count: int
    selling_price: float
    cost_per_piece: float
    packaging_cost: float
    total_cost: float
    profit: float
    profit_margin: float
    image_url: Optional[str]
    is_active: bool
    created_at: datetime
    recipe: List[RecipeIngredientOut] = []
    class Config:
        from_attributes = True


# ─── Customer ─────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    area: Optional[str] = None
    gender: Optional[str] = None
    customer_type: Optional[str] = None
    source: Optional[str] = None
    notes: Optional[str] = None

class CustomerUpdate(CustomerCreate):
    pass

class CustomerOut(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    area: Optional[str]
    gender: Optional[str]
    customer_type: Optional[str]
    source: Optional[str]
    notes: Optional[str]
    total_orders: int
    total_purchases: float
    last_order_date: Optional[date]
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Order ────────────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: float

class OrderItemOut(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float
    estimated_cost: float
    profit: float
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    order_date: date
    discount: float = 0.0
    delivery_fee: float = 0.0
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemCreate]
    boxes_used: int = 0
    bags_used: int = 0
    stickers_used: int = 0

class OrderStatusUpdate(BaseModel):
    status: str

class OrderOut(BaseModel):
    id: int
    order_number: str
    customer_id: Optional[int]
    customer_name: Optional[str] = None
    order_date: date
    status: str
    subtotal: float
    discount: float
    delivery_fee: float
    total_amount: float
    payment_method: Optional[str]
    net_profit: float
    notes: Optional[str]
    approval_status: str
    created_at: datetime
    items: List[OrderItemOut] = []
    boxes_used: int = 0
    bags_used: int = 0
    stickers_used: int = 0
    packaging_cost: float = 0.0
    created_by_name: Optional[str] = None
    class Config:
        from_attributes = True


# ─── Marketing ────────────────────────────────────────────────────────────────

class MarketingCampaignCreate(BaseModel):
    name: str
    platform: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: float = 0.0
    messages_count: int = 0
    orders_count: int = 0
    sales_amount: float = 0.0
    profit_amount: float = 0.0
    notes: Optional[str] = None

class MarketingCampaignUpdate(MarketingCampaignCreate):
    pass

class MarketingCampaignOut(MarketingCampaignCreate):
    id: int
    roas: float
    created_at: datetime
    class Config:
        from_attributes = True


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    today_sales: float
    today_orders: int
    month_sales: float
    month_orders: int
    month_expenses: float
    net_profit: float
    total_customers: int
    best_product: Optional[str]
    top_customer: Optional[str]
    low_stock_alerts: List[dict]
    recent_orders: List[dict]
    monthly_sales_chart: List[dict]
    category_expenses_chart: List[dict]


# ─── Activity Log ──────────────────────────────────────────────────────────────

class ActivityLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    action: str
    details: str
    created_at: datetime
    class Config:
        from_attributes = True
