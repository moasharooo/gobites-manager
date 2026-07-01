from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
from auth import get_current_user, log_activity
import models, schemas

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("", response_model=List[schemas.CustomerOut])
def get_customers(db: Session = Depends(get_db), _=Depends(get_current_user)):
    customers = db.query(models.Customer).order_by(models.Customer.created_at.desc(), models.Customer.id.desc()).all()
    result = []
    for c in customers:
        out = schemas.CustomerOut(
            id=c.id,
            name=c.name,
            phone=c.phone,
            area=c.area,
            gender=c.gender,
            customer_type=c.customer_type,
            source=c.source,
            notes=c.notes,
            total_orders=c.total_orders,
            total_purchases=c.total_purchases,
            last_order_date=c.last_order_date,
            created_at=c.created_at
        )
        result.append(out)
    return result


@router.post("", response_model=schemas.CustomerOut)
def create_customer(data: schemas.CustomerCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    customer = models.Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    log_activity(db, current_user.id, "CREATE_CUSTOMER", f"{current_user.name} created customer '{customer.name}'")
    return schemas.CustomerOut(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        area=customer.area,
        gender=customer.gender,
        customer_type=customer.customer_type,
        source=customer.source,
        notes=customer.notes,
        total_orders=0,
        total_purchases=0.0,
        last_order_date=None,
        created_at=customer.created_at
    )


@router.put("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, data: schemas.CustomerUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for key, value in data.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    log_activity(db, current_user.id, "UPDATE_CUSTOMER", f"{current_user.name} updated details of customer '{customer.name}'")
    return schemas.CustomerOut(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        area=customer.area,
        gender=customer.gender,
        customer_type=customer.customer_type,
        source=customer.source,
        notes=customer.notes,
        total_orders=customer.total_orders,
        total_purchases=customer.total_purchases,
        last_order_date=customer.last_order_date,
        created_at=customer.created_at
    )


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    customer_name = customer.name
    db.delete(customer)
    db.commit()
    log_activity(db, current_user.id, "DELETE_CUSTOMER", f"{current_user.name} deleted customer '{customer_name}'")
    return {"message": "Customer deleted"}
