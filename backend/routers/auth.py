from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from database import get_db
import models, schemas
from auth import verify_password, get_password_hash, create_access_token, get_current_user, log_activity

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(func.lower(models.User.email) == func.lower(data.email)).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    log_activity(db, user.id, "LOGIN", f"{user.name} logged in successfully")
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/register", response_model=schemas.UserOut)
def register(data: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can register new users")
    if db.query(models.User).filter(func.lower(models.User.email) == func.lower(data.email)).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_activity(db, current_user.id, "CREATE_USER", f"{current_user.name} registered new user '{user.name}' ({user.role})")
    return user


@router.get("/users", response_model=List[schemas.UserOut])
def get_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view the user list")
    return db.query(models.User).order_by(models.User.name).all()


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can update users")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if data.name is not None:
        user.name = data.name
    if data.email is not None:
        existing = db.query(models.User).filter(func.lower(models.User.email) == func.lower(data.email), models.User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = data.email
    if data.role is not None:
        user.role = data.role
    if data.password is not None and data.password.strip() != "":
        user.password_hash = get_password_hash(data.password)
        
    db.commit()
    db.refresh(user)
    log_activity(db, current_user.id, "UPDATE_USER", f"{current_user.name} updated details of user '{user.name}'")
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete users")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_name = user.name
    db.delete(user)
    db.commit()
    log_activity(db, current_user.id, "DELETE_USER", f"{current_user.name} deleted user '{user_name}'")
    return {"message": "User deleted successfully"}


@router.get("/activity-log", response_model=List[schemas.ActivityLogOut])
def get_activity_log(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view the activity log")
    
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.created_at.desc()).all()
    
    result = []
    for log in logs:
        result.append(schemas.ActivityLogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.name if log.user else "System / Unknown",
            action=log.action,
            details=log.details,
            created_at=log.created_at
        ))
    return result
