from sqlalchemy import Column, Integer, String, Float
from app.core.database import Base
from pydantic import BaseModel

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    price = Column(Float)
    stock = Column(Integer, default=0)

class ProductCreate(BaseModel):
    name: str
    price: float

class ProductOut(BaseModel):
    id: int
    name: str
    price: float
