'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const CART_STORAGE_KEY = 'paypilot-cart'

export type CartItem = {
  productId: string
  name: string
  price: number
  currency: string
  inventory: number
  imageUrl?: string | null
  quantity: number
}

type ProductForCart = Omit<CartItem, 'quantity'>

type CartContextValue = {
  items: CartItem[]
  isReady: boolean
  itemCount: number
  subtotal: number
  currency: string
  addItem: (product: ProductForCart, quantity?: number) => void
  updateQuantity: (productId: string, quantity: number) => void
  removeItem: (productId: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

function readCart(): CartItem[] {
  try {
    const value = window.localStorage.getItem(CART_STORAGE_KEY)
    const parsed: unknown = value ? JSON.parse(value) : []
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is CartItem => (
      typeof item === 'object' && item !== null &&
      typeof (item as CartItem).productId === 'string' &&
      typeof (item as CartItem).name === 'string' &&
      typeof (item as CartItem).price === 'number' &&
      typeof (item as CartItem).currency === 'string' &&
      typeof (item as CartItem).inventory === 'number' &&
      Number.isInteger((item as CartItem).quantity) && (item as CartItem).quantity > 0
    ))
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readCart())
      setIsReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isReady) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [isReady, items])

  const addItem = useCallback((product: ProductForCart, quantity = 1) => {
    if (product.inventory < 1) return
    const requestedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.productId)
      if (!existing) return [...current, { ...product, quantity: Math.min(requestedQuantity, product.inventory) }]
      return current.map((item) => item.productId === product.productId
        ? { ...item, ...product, quantity: Math.min(item.quantity + requestedQuantity, product.inventory) }
        : item)
    })
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current.flatMap((item) => {
      if (item.productId !== productId) return [item]
      if (!Number.isInteger(quantity) || quantity < 1) return []
      return [{ ...item, quantity: Math.min(quantity, item.inventory) }]
    }))
  }, [])

  const removeItem = useCallback((productId: string) => {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const value = useMemo(() => ({
    items,
    isReady,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
    currency: items[0]?.currency ?? 'INR',
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  }), [addItem, clearCart, isReady, items, removeItem, updateQuantity])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('useCart must be used inside CartProvider')
  return cart
}
