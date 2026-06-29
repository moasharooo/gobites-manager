from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date, datetime
from database import get_db
from auth import get_current_user
import models

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    today = date.today()
    current_month = today.month
    current_year = today.year

    # Today's delivered orders
    today_orders = db.query(models.Order).filter(
        models.Order.order_date == today,
        models.Order.status == "Delivered",
        models.Order.approval_status == "Approved"
    ).all()
    today_sales = sum(o.total_amount for o in today_orders)
    today_orders_count = len(today_orders)

    # Month delivered orders
    month_orders = db.query(models.Order).filter(
        extract('month', models.Order.order_date) == current_month,
        extract('year', models.Order.order_date) == current_year,
        models.Order.status == "Delivered",
        models.Order.approval_status == "Approved"
    ).all()
    month_sales = sum(o.total_amount for o in month_orders)
    month_orders_count = len(month_orders)
    month_net_profit = sum(o.net_profit for o in month_orders)

    # Month expenses
    month_expenses_q = db.query(func.sum(models.Expense.total_cost)).filter(
        extract('month', models.Expense.date) == current_month,
        extract('year', models.Expense.date) == current_year,
        models.Expense.approval_status == "Approved"
    ).scalar()
    month_expenses = month_expenses_q or 0.0

    net_profit = month_sales - month_expenses

    # Total customers
    total_customers = db.query(models.Customer).count()

    # Best product (most quantity sold this month)
    best_product = None
    product_sales = {}
    for order in month_orders:
        for item in order.items:
            name = item.product.name if item.product else "Unknown"
            product_sales[name] = product_sales.get(name, 0) + item.quantity
    if product_sales:
        best_product = max(product_sales, key=product_sales.get)

    # Top customer (highest purchases this month)
    top_customer = None
    customer_totals = {}
    for order in month_orders:
        if order.customer:
            name = order.customer.name
            customer_totals[name] = customer_totals.get(name, 0) + order.total_amount
    if customer_totals:
        top_customer = max(customer_totals, key=customer_totals.get)

    # Low stock alerts
    all_inventory = db.query(models.InventoryItem).all()
    low_stock_alerts = []
    for item in all_inventory:
        if item.status in ("Low", "Critical"):
            low_stock_alerts.append({
                "id": item.id,
                "name": item.name,
                "current_quantity": item.current_quantity,
                "minimum_quantity": item.minimum_quantity,
                "unit": item.unit,
                "status": item.status
            })

    # Recent orders (last 5)
    recent_orders_q = db.query(models.Order).order_by(models.Order.created_at.desc()).limit(5).all()
    recent_orders = []
    for o in recent_orders_q:
        recent_orders.append({
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name if o.customer else "Walk-in",
            "total_amount": o.total_amount,
            "status": o.status,
            "order_date": str(o.order_date)
        })

    # Monthly sales chart (last 6 months)
    monthly_sales_chart = []
    for i in range(5, -1, -1):
        month_num = (current_month - i - 1) % 12 + 1
        year_num = current_year if (current_month - i) > 0 else current_year - 1
        orders_in_month = db.query(models.Order).filter(
            extract('month', models.Order.order_date) == month_num,
            extract('year', models.Order.order_date) == year_num,
            models.Order.status == "Delivered",
            models.Order.approval_status == "Approved"
        ).all()
        sales = sum(o.total_amount for o in orders_in_month)
        profit = sum(o.net_profit for o in orders_in_month)
        month_name = datetime(year_num, month_num, 1).strftime("%b %Y")
        monthly_sales_chart.append({"month": month_name, "sales": sales, "profit": profit})

    # Expenses by category
    expenses_by_cat = db.query(
        models.Expense.category,
        func.sum(models.Expense.total_cost).label("total")
    ).filter(
        extract('month', models.Expense.date) == current_month,
        extract('year', models.Expense.date) == current_year,
        models.Expense.approval_status == "Approved"
    ).group_by(models.Expense.category).all()
    category_expenses_chart = [{"category": row[0], "amount": row[1]} for row in expenses_by_cat]

    # Calculate remaining pieces of chocolates in stock per product
    products = db.query(models.Product).filter(models.Product.is_active == True).all()
    total_pieces_in_stock = 0
    product_stock_breakdown = []
    
    for p in products:
        produced_q = db.query(func.sum(models.ProductionBatch.total_pieces)).filter(
            models.ProductionBatch.product_id == p.id
        ).scalar()
        produced = produced_q or 0
        
        sold_q = db.query(func.sum(models.OrderItem.quantity)).join(models.Order).filter(
            models.OrderItem.product_id == p.id,
            models.Order.status != "Cancelled",
            models.Order.approval_status == "Approved"
        ).scalar()
        sold_pieces = (sold_q or 0) * p.pieces_count
        
        remaining = produced - sold_pieces
        total_pieces_in_stock += max(0, remaining)
        product_stock_breakdown.append({
            "product_id": p.id,
            "product_name": p.name,
            "pieces_in_stock": max(0, remaining),
            "boxes_in_stock": max(0, remaining) / (p.pieces_count or 1)
        })

    # Total sold across all products (all time, non-cancelled)
    total_boxes_sold = 0
    total_pieces_sold = 0
    all_sold = db.query(models.OrderItem, models.Product).join(
        models.Product, models.OrderItem.product_id == models.Product.id
    ).join(models.Order).filter(
        models.Order.status != "Cancelled",
        models.Order.approval_status == "Approved"
    ).all()
    for order_item, product in all_sold:
        boxes = order_item.quantity
        pieces = boxes * (product.pieces_count or 1)
        total_boxes_sold += boxes
        total_pieces_sold += pieces

    return {
        "today_sales": today_sales,
        "today_orders": today_orders_count,
        "month_sales": month_sales,
        "month_orders": month_orders_count,
        "month_expenses": month_expenses,
        "net_profit": net_profit,
        "total_customers": total_customers,
        "best_product": best_product,
        "top_customer": top_customer,
        "low_stock_alerts": low_stock_alerts,
        "recent_orders": recent_orders,
        "monthly_sales_chart": monthly_sales_chart,
        "category_expenses_chart": category_expenses_chart,
        "total_pieces_in_stock": total_pieces_in_stock,
        "product_stock_breakdown": product_stock_breakdown,
        "total_boxes_sold": total_boxes_sold,
        "total_pieces_sold": total_pieces_sold
    }


@router.get("/monthly")
def get_monthly_report(
    month: int = Query(default=None),
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    today = date.today()
    month = month or today.month
    year = year or today.year

    orders = db.query(models.Order).filter(
        extract('month', models.Order.order_date) == month,
        extract('year', models.Order.order_date) == year,
        models.Order.status == "Delivered",
        models.Order.approval_status == "Approved"
    ).all()

    expenses = db.query(models.Expense).filter(
        extract('month', models.Expense.date) == month,
        extract('year', models.Expense.date) == year,
        models.Expense.approval_status == "Approved"
    ).all()

    total_sales = sum(o.total_amount for o in orders)
    total_profit_from_orders = sum(o.net_profit for o in orders)
    total_expenses = sum(e.total_cost for e in expenses)
    net_profit = total_sales - total_expenses

    # Product breakdown
    product_breakdown = {}
    for order in orders:
        for item in order.items:
            name = item.product.name if item.product else "Unknown"
            if name not in product_breakdown:
                product_breakdown[name] = {"quantity": 0, "revenue": 0.0, "profit": 0.0}
            product_breakdown[name]["quantity"] += item.quantity
            product_breakdown[name]["revenue"] += item.total_price
            product_breakdown[name]["profit"] += item.profit

    # Expenses breakdown
    expense_breakdown = {}
    for e in expenses:
        cat = e.category
        expense_breakdown[cat] = expense_breakdown.get(cat, 0.0) + e.total_cost

    return {
        "month": month,
        "year": year,
        "total_sales": total_sales,
        "total_orders": len(orders),
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "product_breakdown": [
            {"name": k, **v} for k, v in sorted(product_breakdown.items(), key=lambda x: x[1]["revenue"], reverse=True)
        ],
        "expense_breakdown": [
            {"category": k, "amount": v} for k, v in sorted(expense_breakdown.items(), key=lambda x: x[1], reverse=True)
        ]
    }


@router.get("/products")
def get_products_report(db: Session = Depends(get_db), _=Depends(get_current_user)):
    products = db.query(models.Product).filter(models.Product.is_active == True).all()
    result = []
    for p in products:
        total_sold = sum(
            item.quantity for item in p.order_items
            if item.order and item.order.status == "Delivered" and item.order.approval_status == "Approved"
        )
        total_revenue = sum(
            item.total_price for item in p.order_items
            if item.order and item.order.status == "Delivered" and item.order.approval_status == "Approved"
        )
        result.append({
            "id": p.id,
            "name": p.name,
            "selling_price": p.selling_price,
            "total_cost": p.total_cost,
            "profit": p.profit,
            "profit_margin": p.profit_margin,
            "total_sold": total_sold,
            "total_revenue": total_revenue
        })
    result.sort(key=lambda x: x["profit_margin"], reverse=True)
    return result


@router.get("/customers")
def get_customers_report(db: Session = Depends(get_db), _=Depends(get_current_user)):
    customers = db.query(models.Customer).all()
    result = []
    for c in customers:
        delivered_orders = [o for o in c.orders if o.status == "Delivered" and o.approval_status == "Approved"]
        total_purchases = sum(o.total_amount for o in delivered_orders)
        result.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "area": c.area,
            "customer_type": c.customer_type,
            "source": c.source,
            "total_orders": len(delivered_orders),
            "total_purchases": total_purchases,
            "last_order_date": str(c.last_order_date) if c.last_order_date else None
        })
    result.sort(key=lambda x: x["total_purchases"], reverse=True)
    return result
