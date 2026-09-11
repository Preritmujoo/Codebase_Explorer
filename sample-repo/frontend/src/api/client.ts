import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000'
})

export async function fetchProducts() {
  const res = await apiClient.get('/api/products')
  return res.data
}

export async function createOrder(userId: number, items: any[]) {
  const res = await apiClient.post('/api/orders', { user_id: userId, items })
  return res.data
}
