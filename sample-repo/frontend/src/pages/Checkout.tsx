import { useCartStore } from '../store/cartStore'
import { apiClient } from '../api/client'

export function Checkout() {
  const items = useCartStore(s => s.items)
  const handlePay = async () => {
    await apiClient.post('/api/orders', { items })
  }
  return <button onClick={handlePay}>Pay ${items.length * 10}</button>
}
