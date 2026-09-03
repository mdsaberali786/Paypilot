'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

const MAX_IMAGE_SIZE = 4 * 1024 * 1024
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif'

export default function AddProductForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [form, setForm] = useState({ name: '', description: '', category: '', price: '', inventory: '' })
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  function chooseImage(file: File | undefined) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      setError('Use a JPEG, PNG, WebP, or GIF image up to 4 MB.')
      return
    }
    setError('')
    setImage(file)
    setPreview(URL.createObjectURL(file))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseImage(event.target.files?.[0])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!image) {
      setError('Choose a product image.')
      return
    }
    setStatus('uploading')
    setError('')
    const data = new FormData()
    data.append('image', image)
    Object.entries(form).forEach(([key, value]) => data.append(key, value))
    try {
      const response = await fetch('/api/products', { method: 'POST', body: data })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to create the product.')
      setStatus('success')
      onCreated()
    } catch (requestError) {
      setStatus('error')
      setError(requestError instanceof Error ? requestError.message : 'Unable to create the product.')
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">New catalog item</p><h2 className="mt-2 text-2xl font-semibold text-slate-950">Add Product</h2></div><button type="button" onClick={onCancel} className="text-sm font-medium text-slate-500 hover:text-slate-900">Cancel</button></div>
      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-white p-8 text-center hover:border-blue-400">
        {preview ? <img src={preview} alt="Product preview" className="h-40 w-full rounded-xl object-contain" /> : <><span className="text-sm font-semibold text-slate-800">Upload product image</span><span className="mt-2 text-xs text-slate-500">JPEG, PNG, WebP, or GIF · up to 4 MB</span></>}
        <input type="file" accept={ACCEPTED_TYPES} onChange={handleFileChange} className="sr-only" />
      </label>
      {image && <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span className="truncate">{image.name}</span><button type="button" onClick={() => { setImage(null); setPreview('') }} className="font-semibold text-blue-700">Remove image</button></div>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Product Name</span><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
        <label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Description</span><textarea required maxLength={2000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
        <label><span className="text-sm font-medium text-slate-700">Category</span><input required maxLength={80} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
        <label><span className="text-sm font-medium text-slate-700">Price (INR)</span><input required min="0.01" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
        <label><span className="text-sm font-medium text-slate-700">Inventory</span><input required min="0" step="1" type="number" value={form.inventory} onChange={(e) => setForm({ ...form, inventory: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900" /></label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-100 p-3 text-sm text-rose-800">{error}</p>}
      {status === 'success' && <p className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm text-emerald-800">Product created successfully.</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={status === 'uploading'} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{status === 'uploading' ? 'Uploading…' : 'Add Product'}</button></div>
    </form>
  )
}
