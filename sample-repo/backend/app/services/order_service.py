from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.services import inventory_service

def create_order(db: Session, user_id: int, items: list[dict]) -> Order:
    total = 0
    for item in items:
        product = db.query(Product).filter(Product.id == item["product_id"]).first()
        if not inventory_service.check_stock(product, item["quantity"]):
            raise ValueError(f"Out of stock: {product.name}")
        total += product.price * item["quantity"]
    order = Order(user_id=user_id, total=total)
    db.add(order)
    db.commit()
    db.refresh(order)
    for item in items:
        oi = OrderItem(order_id=order.id, product_id=item["product_id"], quantity=item["quantity"])
        db.add(oi)
        inventory_service.decrement_stock(db, item["product_id"], item["quantity"])
    db.commit()
    return order

def get_user_orders(db: Session, user_id: int):
    return db.query(Order).filter(Order.user_id == user_id).all()
