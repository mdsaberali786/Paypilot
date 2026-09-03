# PayPilot — AI Agentic Commerce Engine

PayPilot is an AI-powered commerce system designed for the Razorpay AI Buildathon 2026 (Track: AI Growth & Agentic Commerce). It helps merchants increase conversion and revenue through intelligent customer interactions and seamless payment integration.

## Project Purpose

PayPilot enables merchants to:
- Understand customer intent through AI-powered agents
- Provide personalized product recommendations
- Process payments seamlessly via Razorpay
- Track AI decisions and system events in audit trails
- Monitor revenue and conversion metrics through a comprehensive dashboard

## Architecture Overview

The application is built as a monolithic Next.js application with a clear separation of concerns:

- **Frontend**: Next.js 16 with TypeScript and Tailwind CSS
- **Backend**: Next.js API routes and server-side services
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Gemini-powered commerce assistant with audited tool calls
- **Payments**: Razorpay Test Mode with server-side verification and retry recovery

### Project Structure

```
paypilot/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed data
├── src/
│   ├── app/                   # Next.js app directory
│   │   ├── dashboard/         # Merchant dashboard pages
│   │   ├── shop/              # Customer-facing shop pages
│   │   └── page.tsx           # Landing page
│   ├── components/            # React components
│   │   ├── dashboard/         # Dashboard-specific components
│   │   ├── layout/            # Layout components (Header, Footer)
│   │   └── shop/              # Shop-specific components
│   ├── lib/                   # Utility libraries
│   │   └── prisma.ts          # Prisma client singleton
│   └── services/              # Business logic services
│       ├── auditService.ts    # Audit log operations
│       ├── orderService.ts    # Order operations
│       └── productService.ts  # Product operations
├── .env.example               # Environment variable template
└── package.json               # Dependencies and scripts
```

## Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Setup Steps

1. **Clone and navigate to the project**:
   ```bash
   cd paypilot
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure PostgreSQL**:
   - Ensure PostgreSQL is running on your system
   - Create a database named `paypilot`:
     ```bash
     createdb paypilot
     ```
   - Or use your PostgreSQL administration tool to create the database

4. **Set up environment variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Update the `DATABASE_URL` in `.env` with your PostgreSQL credentials:
     ```
     DATABASE_URL="postgresql://username:password@localhost:5432/paypilot?schema=public"
     ```

5. **Run database migrations**:
   ```bash
   npm run db:push
   ```
   This will create the database schema based on `prisma/schema.prisma`.

6. **Generate Prisma client**:
   ```bash
   npm run db:generate
   ```

7. **Seed the database**:
   ```bash
   npm run db:seed
   ```
   This will create:
   - One demo merchant (TechStore Demo)
   - 10 realistic products across Electronics, Furniture, and Accessories categories
   - 3 demo orders with payments
   - 8 audit log entries for dashboard development

## Running the Application

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Pages

- **/** - Landing page with project overview
- **/shop** - Customer product browsing
- **/shop/[id]** - Individual product details
- **/dashboard** - Merchant dashboard overview with metrics
- **/dashboard/products** - Product management
- **/dashboard/orders** - Order tracking and management
- **/dashboard/activity** - AI agent decisions and audit logs
- **/dashboard/growth** - Merchant-scoped conversion analytics and generated growth insights

## Database Schema

The application uses the following main entities:

- **Merchant**: Store/merchant information
- **Product**: Product catalog with inventory tracking
- **Order**: Customer orders with status tracking
- **OrderItem**: Line items within orders
- **Payment**: Payment processing with Razorpay integration
- **AuditLog**: AI agent decisions and system events

### Enums

- **OrderStatus**: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
- **PaymentStatus**: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
- **AuditAction**: ORDER_CREATED, ORDER_UPDATED, PAYMENT_INITIATED, PAYMENT_COMPLETED, PAYMENT_FAILED, PAYMENT_REFUNDED, PRODUCT_RECOMMENDED, AGENT_DECISION, SYSTEM_ERROR

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:seed` - Seed database with demo data

## Current Implementation Status

### ✅ Completed
- Next.js + TypeScript project setup
- Tailwind CSS configuration
- Prisma + PostgreSQL configuration
- Database schema with all entities and enums
- Seed data with merchant, products, orders, payments, and audit logs
- Project structure (components, lib, services)
- Landing page
- Shop page with product display
- Merchant dashboard (overview, products, orders, activity)
- Environment variable configuration
- Basic validation and error handling
- Buyer and seller authentication with merchant-scoped authorization
- Gemini agentic commerce tools and merchant-correct AI audit attribution
- Razorpay Test Mode verification, webhook idempotency, and ownership-hardened payment APIs
- Merchant growth analytics, product performance, and sanitized on-demand insights

### 🔜 Future Implementation
- Real-time payment status updates
- Advanced analytics and reporting beyond the current 7/30-day seller view

## Notes

- Growth insight generation uses a best-effort in-memory cooldown per seller instance; serverless restarts or multiple instances can reset it.
- All functionality is database-driven; no hardcoded data where it should come from the database.
- The application uses a clean, professional UI suitable for a fintech/AI product.

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: Next.js API routes, Prisma ORM
- **Database**: PostgreSQL
- **Development**: ESLint, TypeScript

## License

This project is built for the Razorpay AI Buildathon 2026.
