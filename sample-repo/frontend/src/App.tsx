import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProductList } from './components/ProductList'
import { Cart } from './components/Cart'
import { useCartStore } from './store/cartStore'

export default function App() {
  const items = useCartStore(s => s.items)
  return (
    <BrowserRouter>
      <nav>ShopSphere - Cart ({items.length})</nav>
      <Routes>
        <Route path="/" element={<ProductList />} />
        <Route path="/cart" element={<Cart />} />
      </Routes>
    </BrowserRouter>
  )
}
