from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from auth import get_current_user, log_activity
import models, schemas

router = APIRouter(prefix="/expenses", tags=["Expenses"])


def _adjust_inventory_for_expense(db: Session, expense: models.Expense, old_qty: float = 0.0, action: str = "create"):
    if expense.category not in ("Raw Materials", "Packaging"):
        return

    # Lookup inventory item case-insensitively
    inv_item = db.query(models.InventoryItem).filter(
        func.lower(models.InventoryItem.name) == func.lower(expense.name),
        models.InventoryItem.category == expense.category
    ).first()

    qty_diff = expense.quantity
    if action == "update":
        qty_diff = expense.quantity - old_qty
    elif action == "delete":
        qty_diff = -expense.quantity

    if inv_item:
        inv_item.current_quantity = max(0.0, inv_item.current_quantity + qty_diff)
        if action in ("create", "update") and expense.quantity > 0:
            inv_item.unit_cost = expense.total_cost / expense.quantity
        if expense.unit:
            inv_item.unit = expense.unit
    elif action in ("create", "update") and qty_diff > 0:
        # Create a new inventory item
        unit_cost = (expense.total_cost / expense.quantity) if expense.quantity > 0 else 0.0
        new_item = models.InventoryItem(
            name=expense.name,
            category=expense.category,
            current_quantity=qty_diff,
            unit=expense.unit,
            unit_cost=unit_cost,
            minimum_quantity=0.0,
            supplier=expense.supplier
        )
        db.add(new_item)


@router.get("", response_model=List[schemas.ExpenseOut])
def get_expenses(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Expense).order_by(models.Expense.date.desc()).all()


@router.post("", response_model=schemas.ExpenseOut)
def create_expense(data: schemas.ExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    expense = models.Expense(**data.model_dump())
    expense.approval_status = "Pending" if current_user.role == "staff" else "Approved"
    expense.user_id = current_user.id
    db.add(expense)
    db.flush()
    if expense.approval_status == "Approved":
        _adjust_inventory_for_expense(db, expense, action="create")
    db.commit()
    db.refresh(expense)
    log_activity(db, current_user.id, "CREATE_EXPENSE", f"{current_user.name} created expense '{expense.name}' for {expense.total_cost} JD ({expense.approval_status})")
    return expense


@router.put("/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, data: schemas.ExpenseUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update expenses")
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    old_qty = expense.quantity
    for key, value in data.model_dump().items():
        setattr(expense, key, value)
    
    db.flush()
    if expense.approval_status == "Approved":
        _adjust_inventory_for_expense(db, expense, old_qty=old_qty, action="update")
    db.commit()
    db.refresh(expense)
    log_activity(db, current_user.id, "UPDATE_EXPENSE", f"{current_user.name} updated details of expense '{expense.name}'")
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete expenses")
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense.approval_status == "Approved":
        _adjust_inventory_for_expense(db, expense, action="delete")
    db.delete(expense)
    db.commit()
    log_activity(db, current_user.id, "DELETE_EXPENSE", f"{current_user.name} deleted expense '{expense.name}'")
    return {"message": "Expense deleted"}


@router.put("/{expense_id}/approve", response_model=schemas.ExpenseOut)
def approve_expense(expense_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can approve expenses")
    
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if expense.approval_status == "Approved":
        return expense

    expense.approval_status = "Approved"
    _adjust_inventory_for_expense(db, expense, action="create")
    db.commit()
    db.refresh(expense)
    log_activity(db, current_user.id, "APPROVE_EXPENSE", f"{current_user.name} approved expense '{expense.name}'")
    return expense


@router.put("/{expense_id}/reject", response_model=schemas.ExpenseOut)
def reject_expense(expense_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can reject expenses")
    
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    if expense.approval_status == "Approved":
        _adjust_inventory_for_expense(db, expense, action="delete")

    expense.approval_status = "Rejected"
    db.commit()
    db.refresh(expense)
    log_activity(db, current_user.id, "REJECT_EXPENSE", f"{current_user.name} rejected expense '{expense.name}'")
    return expense
