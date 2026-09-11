from fastapi import FastAPI
from app.api import users, orders, products, auth
from app.core.config import settings

app = FastAPI(title="ShopSphere API", version="0.1.0")

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(products.router, prefix="/api/products", tags=["products"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/stats")
def stats():
    return {"users": 124, "orders": 542}
