from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from auth import get_current_user, log_activity
import models, schemas

router = APIRouter(prefix="/orders", tags=["Orders"])


def _build_order_number(db: Session) -> str:
    count = db.query(models.Order).count()
    return f"ORD-{(count + 1):04d}"


def _serialize_order(order: models.Order, db: Session) -> schemas.OrderOut:
    customer_name = None
    if order.customer:
        customer_name = order.customer.name

    items_out = []
    for item in order.items:
        product_name = item.product.name if item.product else None
        items_out.append(schemas.OrderItemOut(
            id=item.id,
            product_id=item.product_id,
            product_name=product_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price,
            estimated_cost=item.estimated_cost,
            profit=item.profit
        ))

    return schemas.OrderOut(
        id=order.id,
        order_number=order.order_number,
        customer_id=order.customer_id,
        customer_name=customer_name,
        order_date=order.order_date,
        status=order.status,
        subtotal=order.subtotal,
        discount=order.discount,
        delivery_fee=order.delivery_fee,
        total_amount=order.total_amount,
        payment_method=order.payment_method,
        net_profit=order.net_profit,
        notes=order.notes,
        created_at=order.created_at,
        items=items_out,
        boxes_used=order.boxes_used or 0,
        bags_used=order.bags_used or 0,
        stickers_used=order.stickers_used or 0,
        packaging_cost=order.packaging_cost or 0.0,
        approval_status=order.approval_status,
        created_by_name=order.created_by.name if order.created_by else "System"
    )


@router.get("", response_model=List[schemas.OrderOut])
def get_orders(db: Session = Depends(get_db), _=Depends(get_current_user)):
    orders = db.query(models.Order).order_by(models.Order.order_date.desc()).all()
    return [_serialize_order(o, db) for o in orders]


@router.post("", response_model=schemas.OrderOut)
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order_number = _build_order_number(db)

    subtotal = 0.0
    total_cost = 0.0
    order_items = []

    for item_data in data.items:
        product = db.query(models.Product).filter(models.Product.id == item_data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_data.product_id} not found")
        total_price = item_data.quantity * item_data.unit_price
        estimated_cost = item_data.quantity * product.total_cost
        profit = total_price - estimated_cost
        subtotal += total_price
        total_cost += estimated_cost
        order_items.append(models.OrderItem(
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total_price=total_price,
            estimated_cost=estimated_cost,
            profit=profit
        ))

    # Lookup packaging item unit costs to compute packaging cost dynamically
    box_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["box", "boxes"])
    ).first()
    bag_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["bag", "bags"])
    ).first()
    sticker_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["sticker", "stickers"])
    ).first()

    box_cost = box_item.unit_cost if box_item else 0.30
    bag_cost = bag_item.unit_cost if bag_item else 0.25
    sticker_cost = sticker_item.unit_cost if sticker_item else 0.015

    packaging_cost = (data.boxes_used * box_cost) + (data.bags_used * bag_cost) + (data.stickers_used * sticker_cost)

    total_amount = subtotal - data.discount + data.delivery_fee
    # Net profit: Subtract product cost, packaging cost, and delivery fee
    net_profit = total_amount - total_cost - packaging_cost - data.delivery_fee

    order = models.Order(
        order_number=order_number,
        customer_id=data.customer_id,
        order_date=data.order_date,
        status="New",
        subtotal=subtotal,
        discount=data.discount,
        delivery_fee=data.delivery_fee,
        total_amount=total_amount,
        payment_method=data.payment_method,
        net_profit=net_profit,
        notes=data.notes,
        boxes_used=data.boxes_used,
        bags_used=data.bags_used,
        stickers_used=data.stickers_used,
        packaging_cost=packaging_cost,
        approval_status="Pending" if current_user.role == "staff" else "Approved",
        user_id=current_user.id
    )
    db.add(order)
    db.flush()

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    # Deduct packaging quantities from inventory only if approved
    if current_user.role != "staff":
        if box_item and data.boxes_used > 0:
            box_item.current_quantity = max(0.0, box_item.current_quantity - data.boxes_used)
        if bag_item and data.bags_used > 0:
            bag_item.current_quantity = max(0.0, bag_item.current_quantity - data.bags_used)
        if sticker_item and data.stickers_used > 0:
            sticker_item.current_quantity = max(0.0, sticker_item.current_quantity - data.stickers_used)

    db.commit()
    db.refresh(order)
    log_activity(db, current_user.id, "CREATE_ORDER", f"{current_user.name} created order {order_number} ({order.approval_status})")
    return _serialize_order(order, db)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _serialize_order(order, db)


@router.put("/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(order_id: int, data: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = data.status
    db.commit()
    db.refresh(order)
    log_activity(db, current_user.id, "UPDATE_ORDER_STATUS", f"{current_user.name} changed status of order {order.order_number} to '{data.status}'")
    return _serialize_order(order, db)


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Restore packaging quantities back to inventory on order deletion
    box_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["box", "boxes"])
    ).first()
    bag_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["bag", "bags"])
    ).first()
    sticker_item = db.query(models.InventoryItem).filter(
        models.InventoryItem.category == "Packaging",
        func.lower(models.InventoryItem.name).in_(["sticker", "stickers"])
    ).first()
    
    if box_item and order.boxes_used > 0 and order.approval_status == "Approved":
        box_item.current_quantity += order.boxes_used
    if bag_item and order.bags_used > 0 and order.approval_status == "Approved":
        bag_item.current_quantity += order.bags_used
    if sticker_item and order.stickers_used > 0 and order.approval_status == "Approved":
        sticker_item.current_quantity += order.stickers_used

    db.delete(order)
    db.commit()
    log_activity(db, current_user.id, "DELETE_ORDER", f"{current_user.name} deleted order {order.order_number}")
    return {"message": "Order deleted"}


@router.put("/{order_id}/approve", response_model=schemas.OrderOut)
def approve_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve orders")
    
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.approval_status == "Approved":
        return _serialize_order(order, db)

    order.approval_status = "Approved"

    # Deduct packaging inventory
    box_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["box", "boxes"])).first()
    bag_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["bag", "bags"])).first()
    sticker_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["sticker", "stickers"])).first()

    if box_item and order.boxes_used > 0:
        box_item.current_quantity = max(0.0, box_item.current_quantity - order.boxes_used)
    if bag_item and order.bags_used > 0:
        bag_item.current_quantity = max(0.0, bag_item.current_quantity - order.bags_used)
    if sticker_item and order.stickers_used > 0:
        sticker_item.current_quantity = max(0.0, sticker_item.current_quantity - order.stickers_used)

    db.commit()
    db.refresh(order)
    log_activity(db, current_user.id, "APPROVE_ORDER", f"{current_user.name} approved order {order.order_number}")
    return _serialize_order(order, db)


@router.put("/{order_id}/reject", response_model=schemas.OrderOut)
def reject_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can reject orders")
    
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.approval_status == "Approved":
        # Return inventory
        box_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["box", "boxes"])).first()
        bag_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["bag", "bags"])).first()
        sticker_item = db.query(models.InventoryItem).filter(models.InventoryItem.category == "Packaging", func.lower(models.InventoryItem.name).in_(["sticker", "stickers"])).first()

        if box_item and order.boxes_used > 0:
            box_item.current_quantity += order.boxes_used
        if bag_item and order.bags_used > 0:
            bag_item.current_quantity += order.bags_used
        if sticker_item and order.stickers_used > 0:
            sticker_item.current_quantity += order.stickers_used

    order.approval_status = "Rejected"
    db.commit()
    db.refresh(order)
    log_activity(db, current_user.id, "REJECT_ORDER", f"{current_user.name} rejected order {order.order_number}")
    return _serialize_order(order, db)
