from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, log_activity
import models, schemas

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.get("", response_model=List[schemas.SupplierOut])
def get_suppliers(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Supplier).order_by(models.Supplier.name.asc()).all()


@router.get("/{supplier_id}", response_model=schemas.SupplierOut)
def get_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.get("/{supplier_id}/profile")
def get_supplier_profile(supplier_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get all expenses matching this supplier name (case-insensitive for safety)
    from sqlalchemy import func
    expenses = db.query(models.Expense).filter(
        func.lower(models.Expense.supplier) == func.lower(supplier.name)
    ).order_by(models.Expense.date.desc(), models.Expense.id.desc()).all()
    
    # Get all inventory items matching this supplier name (case-insensitive)
    inventory_items = db.query(models.InventoryItem).filter(
        func.lower(models.InventoryItem.supplier) == func.lower(supplier.name)
    ).order_by(models.InventoryItem.name.asc()).all()
    
    # Calculate totals for approved and pending expenses
    total_spent = sum(e.total_cost for e in expenses if e.approval_status == "Approved")
    total_pending = sum(e.total_cost for e in expenses if e.approval_status == "Pending")
    
    return {
        "supplier": {
            "id": supplier.id,
            "name": supplier.name,
            "phone": supplier.phone,
            "location": supplier.location,
            "notes": supplier.notes,
            "created_at": supplier.created_at,
            "branches": [
                {
                    "id": b.id,
                    "name": b.name,
                    "phone": b.phone,
                    "location": b.location,
                    "notes": b.notes,
                    "created_at": b.created_at
                }
                for b in supplier.branches
            ]
        },
        "expenses": [
            {
                "id": e.id,
                "date": e.date,
                "name": e.name,
                "category": e.category,
                "quantity": e.quantity,
                "unit": e.unit,
                "total_cost": e.total_cost,
                "supplier_branch": e.supplier_branch,
                "approval_status": e.approval_status,
                "created_by_name": e.created_by_name,
                "created_at": e.created_at
            }
            for e in expenses
        ],
        "inventory_items": [
            {
                "id": i.id,
                "name": i.name,
                "category": i.category,
                "current_quantity": i.current_quantity,
                "unit": i.unit,
                "unit_cost": i.unit_cost,
                "supplier_branch": i.supplier_branch,
                "status": i.status,
                "created_at": i.created_at
            }
            for i in inventory_items
        ],
        "total_spent": total_spent,
        "total_pending": total_pending
    }


@router.post("", response_model=schemas.SupplierOut)
def create_supplier(data: schemas.SupplierCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check if supplier with this name already exists
    from sqlalchemy import func
    existing = db.query(models.Supplier).filter(
        func.lower(models.Supplier.name) == func.lower(data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A supplier with this name already exists")
        
    supplier_data = data.model_dump()
    branch_name = supplier_data.pop("branch_name") or "Main Branch"
    branch_phone = supplier_data.pop("branch_phone") or data.phone
    branch_location = supplier_data.pop("branch_location") or data.location
    branch_notes = supplier_data.pop("branch_notes") or data.notes

    supplier = models.Supplier(**supplier_data)
    db.add(supplier)
    db.flush()
    
    # Create the initial branch
    branch = models.SupplierBranch(
        supplier_id=supplier.id,
        name=branch_name,
        phone=branch_phone,
        location=branch_location,
        notes=branch_notes
    )
    db.add(branch)
    
    db.commit()
    db.refresh(supplier)
    log_activity(db, current_user.id, "CREATE_SUPPLIER", f"{current_user.name} created supplier '{supplier.name}' with initial branch '{branch.name}'")
    return supplier


@router.put("/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(supplier_id: int, data: schemas.SupplierUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Check duplicate name if name changed
    from sqlalchemy import func
    if data.name != supplier.name:
        existing = db.query(models.Supplier).filter(
            func.lower(models.Supplier.name) == func.lower(data.name)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A supplier with this name already exists")
            
        old_name = supplier.name
        new_name = data.name
        # Update linked expenses and inventory items
        db.query(models.Expense).filter(models.Expense.supplier == old_name).update({models.Expense.supplier: new_name})
        db.query(models.InventoryItem).filter(models.InventoryItem.supplier == old_name).update({models.InventoryItem.supplier: new_name})
        
    for key, value in data.model_dump().items():
        setattr(supplier, key, value)
        
    db.commit()
    db.refresh(supplier)
    log_activity(db, current_user.id, "UPDATE_SUPPLIER", f"{current_user.name} updated details of supplier '{supplier.name}'")
    return supplier


@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    supplier_name = supplier.name
    db.delete(supplier)
    db.commit()
    log_activity(db, current_user.id, "DELETE_SUPPLIER", f"{current_user.name} deleted supplier '{supplier_name}'")
    return {"message": "Supplier deleted successfully"}


# ─── Branches Endpoints ────────────────────────────────────────────────────────

@router.post("/{supplier_id}/branches", response_model=schemas.SupplierBranchOut)
def create_branch(supplier_id: int, data: schemas.SupplierBranchCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Check duplicate branch name for this supplier
    from sqlalchemy import func
    existing = db.query(models.SupplierBranch).filter(
        models.SupplierBranch.supplier_id == supplier_id,
        func.lower(models.SupplierBranch.name) == func.lower(data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A branch with this name already exists for this supplier")
        
    branch = models.SupplierBranch(supplier_id=supplier_id, **data.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    log_activity(db, current_user.id, "CREATE_BRANCH", f"{current_user.name} created branch '{branch.name}' for supplier '{supplier.name}'")
    return branch


@router.delete("/{supplier_id}/branches/{branch_id}")
def delete_branch(supplier_id: int, branch_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    branch = db.query(models.SupplierBranch).filter(
        models.SupplierBranch.id == branch_id,
        models.SupplierBranch.supplier_id == supplier_id
    ).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
        
    # Keep at least one branch
    total_branches = db.query(models.SupplierBranch).filter(models.SupplierBranch.supplier_id == supplier_id).count()
    if total_branches <= 1:
        raise HTTPException(status_code=400, detail="Supplier must have at least one branch")
        
    branch_name = branch.name
    db.delete(branch)
    db.commit()
    log_activity(db, current_user.id, "DELETE_BRANCH", f"{current_user.name} deleted branch '{branch_name}' of supplier ID {supplier_id}")
    return {"message": "Branch deleted successfully"}
