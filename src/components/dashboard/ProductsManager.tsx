'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AddProductForm from './AddProductForm'

export default function ProductsManager({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAdding, setIsAdding] = useState(false)
  if (isAdding) return <AddProductForm onCancel={() => setIsAdding(false)} onCreated={() => { setIsAdding(false); router.refresh() }} />
  return <><div className="flex justify-end"><button type="button" onClick={() => setIsAdding(true)} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">+ Add Product</button></div>{children}</>
}
