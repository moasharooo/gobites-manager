from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_current_user
import models, schemas

router = APIRouter(prefix="/products", tags=["Products"])


def _calc_product(product: models.Product):
    product.total_cost = (product.pieces_count * product.cost_per_piece) + product.packaging_cost
    product.profit = product.selling_price - product.total_cost
    product.profit_margin = (product.profit / product.selling_price * 100) if product.selling_price > 0 else 0.0


def _build_recipe_ri_out(ri: models.ProductRecipeIngredient) -> schemas.RecipeIngredientOut:
    """Format recipe ingredient, restoring user's unit preference."""
    ri_out = schemas.RecipeIngredientOut.model_validate(ri)
    ri_out.inventory_item_name = ri.inventory_item.name if ri.inventory_item else None
    ri_out.inventory_item_unit = ri.inventory_item.unit if ri.inventory_item else None

    # Base unit in inventory vs. user preference unit
    base_unit = ri.inventory_item.unit if ri.inventory_item else ""
    input_unit = ri.input_unit or base_unit
    qty = ri.quantity_per_piece

    if input_unit == "g" and base_unit == "kg":
        qty = qty * 1000
    elif input_unit == "kg" and base_unit == "g":
        qty = qty / 1000

    ri_out.quantity_per_piece = qty
    ri_out.input_unit = input_unit
    return ri_out


def _build_product_out(product: models.Product) -> schemas.ProductOut:
    """Build a ProductOut with recipe ingredients populated."""
    out = schemas.ProductOut.model_validate(product)
    out.recipe = [_build_recipe_ri_out(ri) for ri in product.recipe_ingredients]
    return out


def _save_recipe(product: models.Product, recipe_data: List[schemas.RecipeIngredientCreate], db: Session):
    """Replace a product's recipe ingredients entirely."""
    # Delete existing recipe entries
    db.query(models.ProductRecipeIngredient).filter(
        models.ProductRecipeIngredient.product_id == product.id
    ).delete()
    # Add new entries
    for ri in recipe_data:
        inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == ri.inventory_item_id).first()
        if not inv_item:
            raise HTTPException(status_code=404, detail=f"Inventory item {ri.inventory_item_id} not found")
        
        base_unit = inv_item.unit or ""
        input_unit = ri.input_unit or base_unit
        qty = ri.quantity_per_piece

        # Convert to base unit
        if input_unit == "g" and base_unit == "kg":
            qty = qty / 1000
        elif input_unit == "kg" and base_unit == "g":
            qty = qty * 1000

        db.add(models.ProductRecipeIngredient(
            product_id=product.id,
            inventory_item_id=ri.inventory_item_id,
            quantity_per_piece=qty,
            input_unit=input_unit
        ))


@router.get("", response_model=List[schemas.ProductOut])
def get_products(db: Session = Depends(get_db), _=Depends(get_current_user)):
    products = db.query(models.Product).all()
    return [_build_product_out(p) for p in products]


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _build_product_out(product)


@router.get("/{product_id}/recipe", response_model=List[schemas.RecipeIngredientOut])
def get_product_recipe(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Return the full recipe for a product — used by the production form to auto-fill ingredients."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return [_build_recipe_ri_out(ri) for ri in product.recipe_ingredients]


@router.post("", response_model=schemas.ProductOut)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    recipe = data.recipe
    product_data = data.model_dump(exclude={"recipe"})
    product = models.Product(**product_data)
    _calc_product(product)
    db.add(product)
    db.flush()
    _save_recipe(product, recipe, db)
    db.commit()
    db.refresh(product)
    return _build_product_out(product)


@router.put("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    recipe = data.recipe
    product_data = data.model_dump(exclude={"recipe"})
    for key, value in product_data.items():
        setattr(product, key, value)
    _calc_product(product)
    _save_recipe(product, recipe, db)
    db.commit()
    db.refresh(product)
    return _build_product_out(product)


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}


# ─── Individual Recipe Ingredient Endpoints ────────────────────────────────────

@router.post("/{product_id}/recipe-ingredients", response_model=schemas.RecipeIngredientOut)
def add_recipe_ingredient(product_id: int, data: schemas.RecipeIngredientCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Add a single ingredient to a product's recipe."""
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == data.inventory_item_id).first()
    if not inv_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Check if this item is already in the recipe
    existing = db.query(models.ProductRecipeIngredient).filter(
        models.ProductRecipeIngredient.product_id == product_id,
        models.ProductRecipeIngredient.inventory_item_id == data.inventory_item_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This material is already in the recipe")

    base_unit = inv_item.unit or ""
    input_unit = data.input_unit or base_unit
    qty = data.quantity_per_piece

    # Convert to base unit
    if input_unit == "g" and base_unit == "kg":
        qty = qty / 1000
    elif input_unit == "kg" and base_unit == "g":
        qty = qty * 1000

    ri = models.ProductRecipeIngredient(
        product_id=product_id,
        inventory_item_id=data.inventory_item_id,
        quantity_per_piece=qty,
        input_unit=input_unit
    )
    db.add(ri)
    db.commit()
    db.refresh(ri)
    return _build_recipe_ri_out(ri)


@router.put("/recipe-ingredients/{ri_id}", response_model=schemas.RecipeIngredientOut)
def update_recipe_ingredient(ri_id: int, data: schemas.RecipeIngredientCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Update a single recipe ingredient."""
    ri = db.query(models.ProductRecipeIngredient).filter(models.ProductRecipeIngredient.id == ri_id).first()
    if not ri:
        raise HTTPException(status_code=404, detail="Recipe ingredient not found")

    inv_item = db.query(models.InventoryItem).filter(models.InventoryItem.id == data.inventory_item_id).first()
    if not inv_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    base_unit = inv_item.unit or ""
    input_unit = data.input_unit or base_unit
    qty = data.quantity_per_piece

    # Convert to base unit
    if input_unit == "g" and base_unit == "kg":
        qty = qty / 1000
    elif input_unit == "kg" and base_unit == "g":
        qty = qty * 1000

    ri.inventory_item_id = data.inventory_item_id
    ri.quantity_per_piece = qty
    ri.input_unit = input_unit

    db.commit()
    db.refresh(ri)
    return _build_recipe_ri_out(ri)


@router.delete("/recipe-ingredients/{ri_id}")
def delete_recipe_ingredient(ri_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Delete a single recipe ingredient."""
    ri = db.query(models.ProductRecipeIngredient).filter(models.ProductRecipeIngredient.id == ri_id).first()
    if not ri:
        raise HTTPException(status_code=404, detail="Recipe ingredient not found")
    db.delete(ri)
    db.commit()
    return {"message": "Recipe ingredient deleted"}
