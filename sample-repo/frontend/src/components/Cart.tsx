import { useCartStore } from '../store/cartStore'
import { createOrder } from '../api/client'

export function Cart() {
  const { items, clear } = useCartStore()
  const handleCheckout = async () => {
    await createOrder(1, items.map(i => ({ product_id: i.id, quantity: 1 })))
    clear()
  }
  return (
    <div>
      <h2>Cart</h2>
      {items.map(i => <div key={i.id}>{i.name}</div>)}
      <button onClick={handleCheckout}>Checkout</button>
    </div>
  )
}
