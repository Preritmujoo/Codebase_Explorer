from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import UserCreate
from app.services.auth_service import hash_password, create_access_token, authenticate_user
from app.models.user import User

router = APIRouter()

@router.post("/register")
def register(payload: UserCreate, db: Session = Depends(get_db)):
    hashed = hash_password(payload.password)
    user = User(email=payload.email, hashed_password=hashed)
    db.add(user)
    db.commit()
    return {"id": user.id, "email": user.email}

@router.post("/login")
def login(payload: UserCreate, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"access_token": token}

@router.get("/me")
def me(db: Session = Depends(get_db)):
    return {"message": "protected"}
