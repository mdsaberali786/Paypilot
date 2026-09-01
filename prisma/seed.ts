import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create demo merchant
  const merchant = await prisma.merchant.upsert({
    where: { email: 'demo@paypilot.com' },
    update: {},
    create: {
      name: 'TechStore Demo',
      email: 'demo@paypilot.com',
    },
  })
  console.log('Created merchant:', merchant.name)

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Wireless Bluetooth Headphones',
        description: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
        price: 2999.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 50,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Smart Watch Series 5',
        description: 'Fitness tracking, heart rate monitor, and smartphone notifications',
        price: 4999.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 30,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'USB-C Fast Charger',
        description: '65W fast charging adapter with multiple ports',
        price: 1299.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 100,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Ergonomic Office Chair',
        description: 'Adjustable height, lumbar support, and breathable mesh',
        price: 8999.00,
        currency: 'INR',
        category: 'Furniture',
        inventory: 15,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Mechanical Keyboard',
        description: 'RGB backlit mechanical keyboard with Cherry MX switches',
        price: 5499.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 25,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Standing Desk Converter',
        description: 'Sit-stand desk converter with adjustable height',
        price: 7999.00,
        currency: 'INR',
        category: 'Furniture',
        inventory: 20,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Wireless Mouse',
        description: 'Ergonomic wireless mouse with precision tracking',
        price: 999.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 75,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Monitor Light Bar',
        description: 'Screen bar with adjustable color temperature and brightness',
        price: 2499.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 40,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Laptop Stand',
        description: 'Aluminum laptop stand with adjustable angle',
        price: 1799.00,
        currency: 'INR',
        category: 'Accessories',
        inventory: 60,
        active: true,
      },
    }),
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        name: 'Webcam HD 1080p',
        description: 'Full HD webcam with auto-focus and built-in microphone',
        price: 3499.00,
        currency: 'INR',
        category: 'Electronics',
        inventory: 35,
        active: true,
      },
    }),
  ])
  console.log(`Created ${products.length} products`)

  // Create demo orders
  const order1 = await prisma.order.create({
    data: {
      merchantId: merchant.id,
      customerId: 'customer-1',
      status: 'DELIVERED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      totalAmount: 3998.00,
      currency: 'INR',
      orderItems: {
        create: [
          {
            productId: products[0].id,
            quantity: 1,
            unitPrice: 2999.00,
          },
          {
            productId: products[6].id,
            quantity: 1,
            unitPrice: 999.00,
          },
        ],
      },
    },
  })

  const order2 = await prisma.order.create({
    data: {
      merchantId: merchant.id,
      customerId: 'customer-2',
      status: 'PROCESSING' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      totalAmount: 14998.00,
      currency: 'INR',
      orderItems: {
        create: [
          {
            productId: products[3].id,
            quantity: 1,
            unitPrice: 8999.00,
          },
          {
            productId: products[4].id,
            quantity: 1,
            unitPrice: 5499.00,
          },
        ],
      },
    },
  })

  const order3 = await prisma.order.create({
    data: {
      merchantId: merchant.id,
      customerId: 'customer-3',
      status: 'CONFIRMED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      totalAmount: 2499.00,
      currency: 'INR',
      orderItems: {
        create: [
          {
            productId: products[7].id,
            quantity: 1,
            unitPrice: 2499.00,
          },
        ],
      },
    },
  })

  console.log('Created 3 demo orders')

  // Create demo payments
  await prisma.payment.create({
    data: {
      orderId: order1.id,
      provider: 'razorpay',
      providerPaymentId: 'pay_demo_001',
      amount: 3998.00,
      currency: 'INR',
      status: 'COMPLETED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  })

  await prisma.payment.create({
    data: {
      orderId: order2.id,
      provider: 'razorpay',
      providerPaymentId: 'pay_demo_002',
      amount: 14998.00,
      currency: 'INR',
      status: 'COMPLETED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  })

  await prisma.payment.create({
    data: {
      orderId: order3.id,
      provider: 'razorpay',
      amount: 2499.00,
      currency: 'INR',
      status: 'PROCESSING' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    },
  })

  console.log('Created 3 demo payments')

  // Create audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        merchantId: merchant.id,
        orderId: order1.id,
        action: 'ORDER_CREATED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Customer placed order',
        metadata: { customerId: 'customer-1' },
      },
      {
        merchantId: merchant.id,
        orderId: order1.id,
        action: 'PAYMENT_INITIATED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Payment process started',
        metadata: { amount: 3998.00 },
      },
      {
        merchantId: merchant.id,
        orderId: order1.id,
        action: 'PAYMENT_COMPLETED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Payment successful',
        metadata: { providerPaymentId: 'pay_demo_001' },
      },
      {
        merchantId: merchant.id,
        orderId: order2.id,
        action: 'ORDER_CREATED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Customer placed order',
        metadata: { customerId: 'customer-2' },
      },
      {
        merchantId: merchant.id,
        orderId: order2.id,
        action: 'PAYMENT_COMPLETED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Payment successful',
        metadata: { providerPaymentId: 'pay_demo_002' },
      },
      {
        merchantId: merchant.id,
        orderId: order3.id,
        action: 'ORDER_CREATED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Customer placed order',
        metadata: { customerId: 'customer-3' },
      },
      {
        merchantId: merchant.id,
        orderId: order3.id,
        action: 'PAYMENT_INITIATED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'Payment process started',
        metadata: { amount: 2499.00 },
      },
      {
        merchantId: merchant.id,
        action: 'PRODUCT_RECOMMENDED' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        reason: 'AI agent recommended products',
        metadata: { productIds: [products[0].id, products[4].id] },
      },
    ],
  })

  console.log('Created 8 audit log entries')

  console.log('Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
