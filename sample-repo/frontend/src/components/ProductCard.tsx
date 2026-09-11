import { useCartStore } from '../store/cartStore'

export function ProductCard({ product }: { product: any }) {
  const add = useCartStore(s => s.addItem)
  return (
    <div>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      <button onClick={() => add(product)}>Add to cart</button>
    </div>
  )
}
