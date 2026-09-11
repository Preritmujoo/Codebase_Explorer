from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Product, ProductCreate
from app.services.inventory_service import restock_product

router = APIRouter()

@router.get("/")
def list_products(db: Session = Depends(get_db)):
    return db.query(Product).all()

@router.post("/")
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(name=payload.name, price=payload.price)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@router.post("/{product_id}/restock")
def restock(product_id: int, quantity: int, db: Session = Depends(get_db)):
    return restock_product(db, product_id, quantity)

@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    return db.query(Product).filter(Product.id == product_id).first()
