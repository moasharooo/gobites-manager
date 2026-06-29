from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
from auth import get_current_user
import models, schemas

router = APIRouter(prefix="/production-batches", tags=["Production"])


def _calculate_remaining_pieces(db: Session, batches: List[models.ProductionBatch]) -> dict:
    """
    Returns a dictionary mapping batch_id to remaining_pieces.
    Calculates remaining pieces using FIFO consumption of non-cancelled orders.
    """
    # Group batches by product_id
    batches_by_product = {}
    for b in batches:
        if b.product_id:
            batches_by_product.setdefault(b.product_id, []).append(b)

    remaining_map = {}
    for product_id, prod_batches in batches_by_product.items():
        # Sort batches chronologically (FIFO)
        prod_batches.sort(key=lambda x: (x.production_date, x.id))
        
        # Get product pieces count
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        pieces_per_box = product.pieces_count if product else 1

        # Sum total sold pieces for this product
        sold_q = db.query(func.sum(models.OrderItem.quantity)).join(models.Order).filter(
            models.OrderItem.product_id == product_id,
            models.Order.status != "Cancelled",
            models.Order.approval_status == "Approved"
        ).scalar()
        total_sold_pieces = (sold_q or 0) * pieces_per_box

        # Consume batches FIFO
        for b in prod_batches:
            if total_sold_pieces >= b.total_pieces:
                remaining_map[b.id] = 0
                total_sold_pieces -= b.total_pieces
            else:
                remaining_map[b.id] = b.total_pieces - total_sold_pieces
                total_sold_pieces = 0
                
    # Default for batches without product_id or remaining batches
    for b in batches:
        if b.id not in remaining_map:
            remaining_map[b.id] = b.total_pieces

    return remaining_map


def _build_batch_out(batch: models.ProductionBatch, remaining_map: dict = None) -> schemas.ProductionBatchOut:
    out = schemas.ProductionBatchOut.model_validate(batch)
    out.product_id = batch.product_id
    out.product_name = batch.product.name if batch.product else None
    out.ingredients = []
    for ing in batch.ingredients:
        ing_out = schemas.BatchIngredientOut.model_validate(ing)
        ing_out.inventory_item_name = ing.inventory_item.name if ing.inventory_item else None
        out.ingredients.append(ing_out)
        
    if remaining_map and batch.id in remaining_map:
        out.remaining_pieces = remaining_map[batch.id]
    else:
        out.remaining_pieces = batch.total_pieces
        
    return out


@router.get("", response_model=List[schemas.ProductionBatchOut])
def get_batches(db: Session = Depends(get_db), _=Depends(get_current_user)):
    batches = db.query(models.ProductionBatch).order_by(models.ProductionBatch.production_date.desc(), models.ProductionBatch.id.desc()).all()
    remaining_map = _calculate_remaining_pieces(db, batches)
    return [_build_batch_out(b, remaining_map) for b in batches]


@router.post("", response_model=schemas.ProductionBatchOut)
def create_batch(data: schemas.ProductionBatchCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Check batch name uniqueness
    existing = db.query(models.ProductionBatch).filter(models.ProductionBatch.batch_name == data.batch_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Batch name already exists")

    # Resolve ingredients: if product_id given and no manual ingredients, auto-expand recipe
    ingredients_input = data.ingredients
    if data.product_id and not ingredients_input:
        product = db.query(models.Product).filter(models.Product.id == data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if not product.recipe_ingredients:
            raise HTTPException(
                status_code=400,
                detail=f"Product '{product.name}' has no recipe defined. Add a recipe in Products first."
            )
        # Expand recipe: (quantity_per_product / pieces_count) * total_pieces
        ingredients_input = [
            schemas.BatchIngredientCreate(
                inventory_item_id=ri.inventory_item_id,
                quantity_used=(ri.quantity_per_piece / (product.pieces_count or 1)) * data.total_pieces
            )
            for ri in product.recipe_ingredients
        ]

    # Calculate costs and validate stock
    raw_material_cost = 0.0
    ingredients_data = []
    for ing in ingredients_input:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == ing.inventory_item_id).first()
        if not inv_item:
            raise HTTPException(status_code=404, detail=f"Inventory item {ing.inventory_item_id} not found")
        if inv_item.current_quantity < ing.quantity_used:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {inv_item.name}. Available: {inv_item.current_quantity} {inv_item.unit}, needed: {ing.quantity_used}"
            )
        unit_cost = inv_item.unit_cost
        total_cost = ing.quantity_used * unit_cost
        raw_material_cost += total_cost
        ingredients_data.append({
            "item": inv_item,
            "quantity_used": ing.quantity_used,
            "unit_cost": unit_cost,
            "total_cost": total_cost,
            "inventory_item_id": ing.inventory_item_id
        })

    total_cost = raw_material_cost + data.packaging_cost + data.labor_cost
    cost_per_piece = total_cost / data.total_pieces if data.total_pieces > 0 else 0.0

    batch = models.ProductionBatch(
        batch_name=data.batch_name,
        production_date=data.production_date,
        flavor=data.flavor,
        total_pieces=data.total_pieces,
        raw_material_cost=raw_material_cost,
        packaging_cost=data.packaging_cost,
        labor_cost=data.labor_cost,
        total_cost=total_cost,
        cost_per_piece=cost_per_piece,
        notes=data.notes,
        product_id=data.product_id
    )
    db.add(batch)
    db.flush()

    # Deduct inventory & create ingredient records
    for ing_data in ingredients_data:
        ing_data["item"].current_quantity -= ing_data["quantity_used"]
        batch_ing = models.BatchIngredient(
            batch_id=batch.id,
            inventory_item_id=ing_data["inventory_item_id"],
            quantity_used=ing_data["quantity_used"],
            unit_cost=ing_data["unit_cost"],
            total_cost=ing_data["total_cost"]
        )
        db.add(batch_ing)

    db.commit()
    db.refresh(batch)
    
    # Calculate remaining pieces
    all_batches = db.query(models.ProductionBatch).all()
    remaining_map = _calculate_remaining_pieces(db, all_batches)
    return _build_batch_out(batch, remaining_map)


@router.get("/{batch_id}", response_model=schemas.ProductionBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    batch = db.query(models.ProductionBatch).filter(models.ProductionBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    all_batches = db.query(models.ProductionBatch).all()
    remaining_map = _calculate_remaining_pieces(db, all_batches)
    return _build_batch_out(batch, remaining_map)


@router.delete("/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    batch = db.query(models.ProductionBatch).filter(models.ProductionBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return {"message": "Batch deleted"}
