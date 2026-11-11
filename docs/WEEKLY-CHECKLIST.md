# Checkout, Payments, Orders and Inventory

Implemented in the original NORTHSTAR project, preserving its existing controllers/services, authentication, address editor, models and earlier fixes. No commit or push has been made.

## Checklist

| Requirement | Result |
| --- | --- |
| Select a saved delivery address; add/edit addresses | Implemented. Checkout supports inline add/edit using the existing versioned address editor, plus the saved-address screen. |
| Products, quantities, item totals and final amount | Implemented, calculated and revalidated on the server. |
| Shipping and taxes | Existing rule preserved: INR 50 delivery for subtotals at or below INR 500; free above that. Tax remains zero. |
| Basic coupons | Existing coupon model reused; validity, dates, minimum purchase, caps and usage limits checked. |
| Cash on Delivery | Implemented with actual order creation, a unique order ID, stock reservation and cart clearing. |
| Razorpay | Complete application integration: hosted checkout, server signature/payment checks, exact-amount capture of authorized payments, callback-loss recovery, owner/admin reconciliation, signed events and idempotent refunds. Merchant keys, account activation and public webhook configuration remain user setup; real account transactions are not yet verified. |
| Payment success/failure pages | Implemented; displayed payment state comes from the server, not the page URL. |
| Retry without duplicate orders | Implemented with checkout request IDs, unique database indexes and reuse/reconciliation of the original gateway order. |
| Customer order list/details | Implemented, including ID, date, total, status, address, items and payment data. |
| Eligible cancellation, optional reason | Implemented for Pending/Confirmed orders. Stock is restored transactionally once. |
| Return request, mandatory reason | Implemented for delivered orders. |
| PDF invoice download | Implemented for the owning customer and admins, including multi-page invoices. |
| Customer search and status tracking | Implemented for order IDs and product/variant names, with timeframe/status filters and all six requested order statuses. |
| Admin newest-first order list and customer details | Implemented; new orders retain a customer snapshot; older orders can resolve current customer details. |
| Admin search/filter/sort/pagination | Implemented: order ID/customer name/email search; order/payment/return filters; newest/oldest/total sort; page sizes 10/25/50. |
| Permitted status transitions | Pending -> Confirmed -> Shipped -> Out for Delivery -> Delivered. Cancellation is a separate eligible action. Unpaid online orders cannot be fulfilled. |
| Review returns | Admin accepts or rejects, with an optional review note. |
| Complete returns | Admin separately confirms returned goods were received. Stock is not restored merely on approval. |
| Product/variant inventory | Implemented with atomic edits and version checks; aggregate product stock follows listed variants. |
| Prevent overselling and duplicate adjustments | Transactions, conditional stock updates, optimistic versions, operation states and an inventory-restored marker are used. |
| Order and stock transactions | Implemented on the existing MongoDB replica set. |
| Server-side payment verification | HMAC signature plus provider payment ID, order ID, captured status, currency and exact amount. Raw signed webhooks and server-side capture of authorized payments are supported. Browser success URLs never determine paid status. |
| Idempotent payments/orders/refunds | Implemented; Razorpay refunds use a stable X-Refund-Idempotency key. |
| Consistent cancellation/refund states | Implemented. A late capture on a cancelled order does not reopen fulfillment; it creates a pending refund. |
| Authorization | Existing auth/customer/admin middleware is reused. Every customer order/invoice lookup is scoped to the owner. |
| Order/payment history | Implemented and displayed, including status changes, return decisions and payment/refund references. |

## Order and inventory flow

Available stock is reserved inside the order-creation transaction. COD orders become Confirmed immediately. Online orders remain Pending while payment is incomplete, retaining the reservation; capture confirms them without deducting stock again. Customers/admins can cancel eligible orders to release reservations. There is no automatic unpaid-order expiry in this implementation.

Order creation, product/variant stock changes, coupon usage and cart clearing commit together or all roll back. Repeating a checkout request with different details is rejected. Successful retries return the original order.

Cancellation is allowed before shipment. Returns are whole-order returns after delivery. Acceptance authorizes a return; completing it confirms the physical goods were received and restores stock once. Rejected returns leave inventory unchanged. Full refunds include the order's final paid amount.

Cash refunds are manual: an administrator enters a payment/voucher reference only after cash has actually been returned. The app records the refund; it does not move cash or automatically credit a wallet. Online refunds remain pending until the configured gateway confirms them. A failed gateway refund is kept visible rather than falsely marked completed.

## Screens

- `/checkout`
- `/orders`, `/orders/:id`
- `/orders/:id/payment/success`, `/orders/:id/payment/failure`
- `/admin/orders`, `/admin/orders/:id`
- `/admin/inventory`, `/admin/payments`, `/admin/returns`
- `/orders/:id/return`

The existing account menu links to My Orders; the admin navigation links to Orders and Inventory; the cart links to Checkout.

## API additions

Customer-authenticated routes under `/api/orders`:

| Method/path | Purpose |
| --- | --- |
| POST `/preview` | Validate address/cart/coupon and return the server quote. |
| POST `/` | Place an order. Body: addressId, optional couponCode, paymentMethod, requestId, expectedTotalPaise. Returns 201 on creation, 200 on replay. |
| GET `/`, GET `/:id` | List and retrieve owned orders. |
| POST `/:id/cancel` | Cancel an eligible order; reason is optional. |
| POST `/:id/return` | Request a return with a mandatory reason. |
| GET `/:id/invoice` | Download the order's PDF invoice. |
| POST `/:id/payment` | Start/retry or reconcile the existing gateway payment. |
| POST `/:id/payment/verify` | Verify signature/payment identity, capture an authorized payment and confirm captured payment details. |
| POST `/:id/payment/reconcile` | Recover the current provider state on the same order; no new payable order is created. |

Admin-authenticated routes:

- GET `/api/admin/orders`, GET `/api/admin/orders/:id`
- PATCH `/api/admin/orders/:id/status`
- POST `/api/admin/orders/:id/cancel`
- POST `/api/admin/orders/:id/return/review` with decision `accepted` or `rejected` and optional note
- POST `/api/admin/orders/:id/return/complete` after goods are received
- POST `/api/admin/orders/:id/refund` (cash refunds require a reference)
- POST `/api/admin/orders/:id/payment/reconcile`
- GET `/api/admin/orders/:id/invoice`
- GET `/api/admin/inventory`, PATCH `/api/admin/inventory/:id` with stock, variantId and version

Provider callback: POST `/api/payments/razorpay/webhook`. This endpoint verifies the raw-body signature rather than using a browser login session.

JSON endpoints retain the project's `{ success, data }` success convention and existing error middleware. Controllers adapt HTTP inputs; domain services hold business logic. Invoices use binary PDF responses.

## Payment configuration (merchant setup remains)

No real payment credentials were requested, read or written. Cash on Delivery works without them. If online payment credentials are absent, a new online order is rejected before reserving stock or clearing the cart; the shopper can choose COD.

The completed integration expects these environment variable names: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Do not put values in this document or source control. Merchant capture settings and public webhook registration must be configured in the provider account before real payments are used. Use payment.authorized/payment.captured/payment.failed, order.paid and refund.processed/refund.failed events. See RAZORPAY-SETUP.md and the blank backend/razorpay.env.example template.

A payment setup timeout is reconciled by its original receipt before another payable gateway order can be created. If an ambiguous provider operation cannot be reconciled, the API reports that support is required; it does not blindly repeat the charge operation.

Invoice fonts use an installed Unicode font where available; `INVOICE_FONT_PATH` can select a licensed deployment font. The supplied Windows environment was checked with Nirmala UI, including a multi-page invoice.

## Verification

- Standard backend suite after payment completion: 139 passed, zero failed. The separate database integration suite is intentionally skipped unless explicitly enabled.
- Full isolated replica-set integration suite after payment completion: 23 passed, zero failed, including the Postman collection and HTTP payment/capture/refund simulator.
- Frontend production build and ESLint: passed. The existing bundle-size warning remains.
- Existing and new browser regressions in headless Edge: passed, including mobile checkout, COD placement, details, cancellation, inventory editing, return review/receipt/refund records, invoice downloads, and payment failure/success/retry screens.
- PDF layout: rendered and visually checked for a single-item invoice and a 50-item, five-page invoice.
- Backend and frontend dependency audits: zero reported vulnerabilities. The frontend uses targeted minimatch 11.0.5 overrides for ESLint and its config-array dependency. Lint coverage remained identical across all source files; deliberate undefined-variable errors are still detected and generated build files remain ignored. Revisit these overrides when ESLint adopts the fixed dependency itself. See [the upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
- Real merchant payments, actual fund transfers, production data and live provider callbacks were not exercised. Tests used fixture accounts and temporary databases named `northstar_codex_test_*`, removed after each run. The real NORTHSTAR database was not modified by tests.

## Running the checks

Backend: `npm test`.

Frontend: `npm run build`, `npm run lint`, `npm run test:regression`. Playwright is now a development dependency; the browser tests use installed Edge by default (or set BROWSER_CHANNEL to chrome).

For transaction/payment tests, start the local simulator from the repository root:

```powershell
postman simulation run postman/simulations/payments.sim.yaml --port 4519 --no-history --output ndjson
```

Then from backend, in a separate terminal:

```powershell
$env:NORTHSTAR_INTEGRATION='1'
$env:NORTHSTAR_POSTMAN='1'
$env:RAZORPAY_TEST_URL='http://127.0.0.1:4519/razorpay'
node --test tests/orderTransactions.test.js
```

These tests create/drop their own temporary database. They do not load the project's `.env`. Postman collection run results are kept local with `--no-report-events`.

The saved collection is `postman/northstar-orders.postman_collection.json`. Its seeded scenario is run by the integration test; do not point its write requests at production. The simulator's control endpoints are fixture-only and do not exist in the real provider API.

## Provider references

- [Standard Checkout integration](https://github.com/razorpay/markdown-docs/blob/master/payments/payment-gateway/web-integration/standard/integration-steps.md)
- [Order creation](https://github.com/razorpay/markdown-docs/blob/master/api/orders/create.md)
- [Payment retrieval](https://github.com/razorpay/markdown-docs/blob/master/api/payments/fetch-with-id.md)
- [Idempotent refunds](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md)
- [Webhook validation](https://github.com/razorpay/markdown-docs/blob/master/webhooks/validate-test.md)

Public API discovery through Orbit was attempted but its hostname could not be resolved; official provider contracts were used instead. The installed Postman CLI supports local collections/simulations but does not implement `postman status`; cloud owner/mock discovery was therefore not used.


## Payment completion audit

All items in the user-side, admin-side and technical checklists above are implemented in application code. The remaining merchant steps are adding Key ID/Key Secret/webhook secret, registering the matching public HTTPS webhook and completing the account Test Mode/go-live checks described in RAZORPAY-SETUP.md. Those external checks cannot be replaced by simulation.

New safeguards include one active browser payment window per order, bounded network/script-load timeouts, allowlisted callback fields, popup closure on failure, recovery after a lost verification response, preservation of provider linkage if cancellation races setup, no capture of an already-cancelled authorization, and a refund due for any late captured cancellation. Webhook processing stores event-ID/payload-digest receipts; repeated events do not duplicate payment history. Captured or refunded states cannot regress due to delayed failure events.

The focused browser payment suite is `npm run test:payments`. Run all browser suites sequentially to avoid sharing Vite dependency-cache writes. The original storefront fixture suite may log its existing external Google script error `_.zd` while its assertions still pass; the payment harness runs without loading that external script.
