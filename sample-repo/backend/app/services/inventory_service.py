from sqlalchemy.orm import Session
from app.models.product import Product

def check_stock(product: Product, quantity: int) -> bool:
    return product.stock >= quantity

def decrement_stock(db: Session, product_id: int, quantity: int):
    product = db.query(Product).filter(Product.id == product_id).first()
    product.stock -= quantity
    db.commit()

def restock_product(db: Session, product_id: int, quantity: int):
    product = db.query(Product).filter(Product.id == product_id).first()
    product.stock += quantity
    db.commit()
    return product
