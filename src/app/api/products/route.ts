import { del, put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { createProduct } from '@/services/productService'
import { getCurrentSeller } from '@/services/sellerAuth'

const MAX_IMAGE_SIZE = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function fieldText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  const merchant = await getCurrentSeller()
  if (!merchant) return NextResponse.json({ error: 'Seller authentication required.' }, { status: 401 })
  const formData = await request.formData()
  const image = formData.get('image')
  const name = fieldText(formData.get('name'))
  const description = fieldText(formData.get('description'))
  const category = fieldText(formData.get('category'))
  const price = Number(fieldText(formData.get('price')))
  const inventory = Number(fieldText(formData.get('inventory')))

  if (!name || name.length > 120 || !description || description.length > 2000 || !category || category.length > 80) {
    return NextResponse.json({ error: 'Enter a valid name, description, and category.' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price <= 0 || price > 100000000 || !Number.isInteger(inventory) || inventory < 0 || inventory > 100000000) {
    return NextResponse.json({ error: 'Enter a valid positive price and non-negative inventory.' }, { status: 400 })
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: 'Choose a product image.' }, { status: 400 })
  }
  if (!ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, WebP, or GIF image up to 4 MB.' }, { status: 400 })
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Image storage is not configured on the server.' }, { status: 503 })
  }

  let imageUrl: string | undefined
  try {
    const blob = await put(`products/${crypto.randomUUID()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`, image, { access: 'public', addRandomSuffix: false })
    imageUrl = blob.url
    const product = await createProduct({ merchantId: merchant.id, name, description, category, price, inventory, imageUrl })
    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    if (imageUrl) await del(imageUrl).catch(() => undefined)
    console.error('Product creation failed', error)
    return NextResponse.json({ error: 'Unable to create the product right now.' }, { status: 500 })
  }
}
