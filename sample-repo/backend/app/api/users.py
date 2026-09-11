from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User

router = APIRouter()

@router.get("/")
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == user_id).first()

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    db.delete(user)
    db.commit()
    return {"deleted": user_id}
