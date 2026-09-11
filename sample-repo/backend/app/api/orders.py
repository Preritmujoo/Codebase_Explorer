from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.order_service import create_order, get_user_orders

router = APIRouter()

@router.get("/")
def list_orders(user_id: int, db: Session = Depends(get_db)):
    return get_user_orders(db, user_id)

@router.post("/")
def place_order(user_id: int, items: list[dict], db: Session = Depends(get_db)):
    return create_order(db, user_id, items)

@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    from app.models.order import Order
    return db.query(Order).filter(Order.id == order_id).first()
