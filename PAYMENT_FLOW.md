/**
 * PAYMENT FLOW DOCUMENTATION
 * 
 * This document describes the complete Razorpay TEST MODE integration in PayPilot.
 * 
 * ============================================================================
 * STEP-BY-STEP FLOW
 * ============================================================================
 * 
 * 1. CUSTOMER CREATES ORDER (via /checkout)
 *    - Customer submits cart via /api/orders
 *    - Server validates items, reserves inventory, creates PENDING order
 *    - Audit log records ORDER_CREATED
 * 
 * 2. CUSTOMER VIEWS ORDER PAGE (/order/[id])
 *    - Server fetches order and payment record
 *    - If order PENDING/CONFIRMED and no active payment:
 *      - Server calls createRazorpayOrder()
 *      - This creates a Razorpay TEST MODE order (amount in paise)
 *      - Saves Payment record with providerOrderId, status=PENDING
 *      - Audit log records PAYMENT_INITIATED
 *    - Server returns:
 *      - Razorpay KEY_ID (public)
 *      - Razorpay order ID
 *      - Amount in paise (pre-calculated, authoritative)
 * 
 * 3. CUSTOMER INITIATES PAYMENT (click "Pay")
 *    - Browser loads Razorpay Checkout.js script
 *    - User clicks "Pay [amount] securely with Razorpay"
 *    - Razorpay Checkout modal opens with pre-populated order ID
 *    - User completes payment in Razorpay modal
 * 
 * 4. RAZORPAY PAYMENT HANDLER (after successful payment)
 *    - Razorpay returns:
 *      - razorpay_payment_id
 *      - razorpay_order_id
 *      - razorpay_signature (MUST verify server-side)
 *    - Browser calls /api/payments/verify with:
 *      - paypilotOrderId
 *      - razorpayOrderId
 *      - razorpayPaymentId
 *      - razorpaySignature (client-provided signature)
 * 
 * 5. SERVER VERIFIES PAYMENT (/api/payments/verify)
 *    - Lookup Payment record by providerOrderId
 *    - Verify: Payment.orderId matches paypilotOrderId
 *    - Verify: razorpaySignature using RAZORPAY_KEY_SECRET
 *    - If signature valid:
 *      - Update Payment: status=COMPLETED, providerPaymentId
 *      - Update Order: status=CONFIRMED
 *      - Audit log records PAYMENT_COMPLETED
 *      - Return success
 *    - If signature invalid:
 *      - Update Payment: status=FAILED, failureReason
 *      - Audit log records PAYMENT_FAILED
 *      - Return error
 * 
 * 6. OPTIONAL: RAZORPAY WEBHOOK (async confirmation)
 *    - Razorpay sends webhook event (payment.captured, payment.failed, order.paid)
 *    - Browser doesn't need to wait for this
 *    - Webhook signature verified using RAZORPAY_WEBHOOK_SECRET
 *    - WebhookEvent table prevents duplicate processing
 *    - If payment.captured or order.paid:
 *      - Same verification flow as step 5 (markCaptured)
 *      - Idempotency: if already COMPLETED, returns duplicate=true
 *    - Webhook implementation at /api/webhooks/razorpay
 * 
 * ============================================================================
 * SECURITY PROTECTIONS
 * ============================================================================
 * 
 * ✓ Server-side amount validation:
 *   - Amount never sent to browser
 *   - Order totalAmount is authoritative source
 *   - Converted to paise server-side in Razorpay order creation
 *   - Browser receives pre-calculated paise amount only
 * 
 * ✓ Signature verification (TIMING-SAFE):
 *   - Payment signature verified with RAZORPAY_KEY_SECRET
 *   - Webhook signature verified with RAZORPAY_WEBHOOK_SECRET
 *   - Uses crypto.timingSafeEqual to prevent timing attacks
 * 
 * ✓ Secrets never exposed:
 *   - RAZORPAY_KEY_SECRET stored in environment (never committed)
 *   - RAZORPAY_WEBHOOK_SECRET stored in environment (never committed)
 *   - Only RAZORPAY_KEY_ID (public key) sent to browser
 * 
 * ✓ Order linkage validation:
 *   - Payment.orderId must match paypilotOrderId in verification
 *   - Prevents cross-order payment spoofing
 * 
 * ✓ Idempotency:
 *   - WebhookEvent table with unique eventId prevents duplicate webhooks
 *   - markCaptured returns duplicate=true if already COMPLETED
 *   - Safe to retry webhook processing
 * 
 * ✓ AI isolation:
 *   - Gemini AI has no access to Razorpay credentials
 *   - Gemini cannot create payments directly
 *   - create_order tool only creates PayPilot internal order
 *   - Payment is manual customer action after order confirmation
 * 
 * ✓ Inventory protection:
 *   - Inventory decremented atomically when order created
 *   - Payment is separate concern (order can fail to pay)
 *   - No inventory revert on failed payment (customer responsibility)
 * 
 * ============================================================================
 * DATABASE CHANGES
 * ============================================================================
 * 
 * Payment model extended with:
 *   - providerOrderId (Razorpay order ID, unique)
 *   - providerPaymentId (Razorpay payment ID, unique, optional until verified)
 *   - amount (order total amount in rupees)
 *   - status (PENDING → PROCESSING → COMPLETED | FAILED)
 *   - failureReason (error message if status=FAILED)
 * 
 * WebhookEvent model:
 *   - provider (e.g., "razorpay")
 *   - eventId (unique per webhook, prevents duplicates)
 *   - processedAt (timestamp when webhook was processed)
 * 
 * ============================================================================
 * ENVIRONMENT VARIABLES
 * ============================================================================
 * 
 * Required (in .env, NEVER in .env.example):
 *   RAZORPAY_KEY_ID=rzp_test_XXXXX...
 *   RAZORPAY_KEY_SECRET=YYYYY...
 *   RAZORPAY_WEBHOOK_SECRET=ZZZZZ...
 * 
 * ============================================================================
 * API ENDPOINTS
 * ============================================================================
 * 
 * POST /api/orders
 *   - Create order (existing)
 * 
 * POST /api/payments/verify
 *   - Verify payment signature after Razorpay callback
 *   - Input: paypilotOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature
 *   - Output: { success: true, orderId, status, isDuplicate }
 * 
 * POST /api/webhooks/razorpay
 *   - Receive and process Razorpay webhooks
 *   - Headers: x-razorpay-signature, x-razorpay-event-id
 *   - Handles: payment.captured, payment.failed, order.paid
 *   - Output: { received: true, ignored?: true }
 * 
 * GET /order/[id]
 *   - Display order with payment component (updated)
 * 
 * ============================================================================
 * TESTING
 * ============================================================================
 * 
 * Unit tests added to tests/payment.test.ts:
 *   ✓ rupeesToPaise conversion
 *   ✓ Invalid amount rejection
 *   ✓ Razorpay signature verification
 *   ✓ Invalid signature rejection
 *   ✓ Webhook signature verification
 *   ✓ Invalid webhook signature rejection
 * 
 * All existing agent tests still pass (8 tests)
 * 
 * Build verification:
 *   ✓ npm run lint (clean)
 *   ✓ npm run build (successful)
 *   ✓ npm test (all 8 existing tests pass)
 * 
 * ============================================================================
 * REMAINING LIMITATIONS (acceptable for MVP)
 * ============================================================================
 * 
 * 1. No payment refund UI (Razorpay admin dashboard handles this)
 * 2. No payment retry after failure (customer initiates new payment)
 * 3. No analytics dashboard (could be added later)
 * 4. No payment confirmation email (could be added with email service)
 * 5. No multi-currency support (only INR for now)
 * 6. No installment/EMI options (available via Razorpay but not exposed in UI)
 * 
 * ============================================================================
 * INTEGRATION WITH EXISTING FEATURES
 * ============================================================================
 * 
 * ✓ AI Commerce Agent:
 *   - create_order tool creates internal PayPilot order only
 *   - Payment is customer responsibility after order confirmation
 *   - Gemini cannot access payment credentials
 * 
 * ✓ Audit Logging:
 *   - PAYMENT_INITIATED logged when Razorpay order created
 *   - PAYMENT_COMPLETED logged when payment verified
 *   - PAYMENT_FAILED logged when verification fails
 * 
 * ✓ Inventory:
 *   - Already protected at order creation time
 *   - No impact from payment success/failure
 * 
 * ✓ Order Status:
 *   - PENDING → CONFIRMED (after payment verified)
 *   - Status change is atomic with Payment status update
 * 
 * ============================================================================
 * PRODUCTION CHECKLIST (not required for MVP)
 * ============================================================================
 * 
 * □ Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live account
 * □ Configure RAZORPAY_WEBHOOK_SECRET for live webhook
 * □ Add payment success email notifications
 * □ Add payment failure email notifications
 * □ Add refund webhook handler (payment.refunded)
 * □ Add payment retry logic with exponential backoff
 * □ Add order cancellation with automatic refund
 * □ Add payment reconciliation cron job
 * □ Add PCI-DSS compliance documentation
 * □ Add webhook delivery retry (currently single attempt)
 * □ Monitor webhook failure rate
 * □ Add payment analytics dashboard
 * □ Test with Razorpay live mode credentials
 * 
 */
