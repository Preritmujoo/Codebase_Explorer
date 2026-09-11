import { useEffect, useState } from 'react'
import { fetchProducts } from '../api/client'
import { ProductCard } from './ProductCard'

export function ProductList() {
  const [products, setProducts] = useState<any[]>([])
  useEffect(() => {
    fetchProducts().then(setProducts)
  }, [])
  return (
    <div className="grid">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
