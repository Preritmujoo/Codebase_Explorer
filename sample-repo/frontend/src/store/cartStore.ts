import { create } from 'zustand'

type CartState = {
  items: any[]
  addItem: (p: any) => void
  clear: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (p) => set(s => ({ items: [...s.items, p] })),
  clear: () => set({ items: [] })
}))
