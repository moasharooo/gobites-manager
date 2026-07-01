from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user, log_activity
import models, schemas

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=List[schemas.InventoryItemOut])
def get_inventory(db: Session = Depends(get_db), _=Depends(get_current_user)):
    items = db.query(models.InventoryItem).all()
    result = []
    for item in items:
        out = schemas.InventoryItemOut.model_validate(item)
        out.status = item.status
        result.append(out)
    return result


@router.post("", response_model=schemas.InventoryItemOut)
def create_item(data: schemas.InventoryItemCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    item = models.InventoryItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    log_activity(db, current_user.id, "CREATE_INVENTORY", f"{current_user.name} added inventory item '{item.name}'")
    out = schemas.InventoryItemOut.model_validate(item)
    out.status = item.status
    return out


@router.put("/{item_id}", response_model=schemas.InventoryItemOut)
def update_item(item_id: int, data: schemas.InventoryItemUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    log_activity(db, current_user.id, "UPDATE_INVENTORY", f"{current_user.name} updated inventory item '{item.name}'")
    out = schemas.InventoryItemOut.model_validate(item)
    out.status = item.status
    return out


@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    item = db.query(models.InventoryItem).filter(models.InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Find all product recipe ingredients referencing this item
    recipe_items = db.query(models.ProductRecipeIngredient).filter(
        models.ProductRecipeIngredient.inventory_item_id == item_id
    ).all()
    
    # Collect parent products to recalculate cost later
    product_ids_to_recalc = set(ri.product_id for ri in recipe_items)
    
    # Delete recipe ingredients
    for ri in recipe_items:
        db.delete(ri)
        
    # Delete batch ingredient references
    db.query(models.BatchIngredient).filter(
        models.BatchIngredient.inventory_item_id == item_id
    ).delete(synchronize_session=False)
    
    item_name = item.name
    db.delete(item)
    db.commit()
    
    # Recalculate product costs for affected products
    from routers.products import _calc_product
    for prod_id in product_ids_to_recalc:
        product = db.query(models.Product).filter(models.Product.id == prod_id).first()
        if product:
            _calc_product(product, db)
    db.commit()
    
    log_activity(db, current_user.id, "DELETE_INVENTORY", f"{current_user.name} deleted inventory item '{item_name}'")
    return {"message": "Inventory item deleted"}
