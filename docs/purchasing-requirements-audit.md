# Purchasing requirements audit

Reviewed 10 November 2026. All 32 requested capabilities are present in the inspected NORTHSTAR source. Verification is scoped to the tests below; it is not certification of production readiness.

## Requirement checklist

| Area | Requirement | Implementation evidence (repository-relative) | Verification |
|---|---|---|---|
|Checkout|Select an existing address; add/edit addresses|northstar/src/features/shop/checkout.jsx; northstar/src/features/profile/AddressForm.jsx|Browser: checkout/address flow; database: owned address validation|
|Checkout|Products, quantities, line totals and payable amount|northstar/src/features/orders/PurchaseParts.jsx; backend/services/orderService.js|Browser: server totals; database: stale-total rollback|
|Checkout|Shipping and taxes|backend/services/orderService.js; settingsService.js|Database: settings and checkout calculation checks|
|Checkout|Basic coupons|backend/services/orderService.js; couponService.js|Database: real coupon discount, quota and expiry cases|
|Checkout|Cash on Delivery|backend/services/checkoutService.js|Browser and database: COD placement and delivery collection|
|Checkout|Razorpay online payment|northstar/src/features/orders/payment.js; backend/services/paymentService.js|Local HTTP simulator and real isolated database; merchant acceptance remains pending|
|Checkout|Payment success and failure pages|northstar/src/features/orders/PaymentResult.jsx|Browser: both states and server-confirmed refresh|
|Checkout|Retry failed payments without duplicate orders|backend/services/paymentService.js; checkoutService.js|Database/simulator: same gateway order, lost-response recovery; browser: retry|
|Customer orders|Unique ID, order date, total and status|backend/services/orderNumberService.js; northstar/src/features/orders/OrderCard.jsx|Database: order reference allocation; browser: cards|
|Customer orders|Complete order details|northstar/src/features/orders/CustomerOrders.jsx|Browser: products, financial summary and delivery details|
|Customer orders|Eligible cancellation with optional reason|backend/services/customerOrderService.js|Database: eligibility, omitted reason, retry and restoration; browser: cancel|
|Customer orders|Delivered-order returns with required reason|backend/services/returnService.js; northstar/src/features/orders/ReturnRequest.jsx|Database/browser: reason validation, delivered eligibility and review|
|Customer orders|Download PDF invoice|backend/services/invoiceService.js; northstar/src/features/orders/purchaseData.js|Database: PDF response and ownership; browser: download|
|Customer orders|Search orders|backend/services/customerOrderService.js; northstar/src/features/orders/CustomerOrders.jsx|Database/browser: product/variant/ID search and pagination|
|Customer orders|Pending, Confirmed, Shipped, Out for Delivery, Delivered, Cancelled|backend/constants/orders.js; northstar/src/features/orders/PurchaseParts.jsx|Database: permitted progression; browser: status timeline and eligibility|
|Admin orders|Newest first|backend/services/customerOrderService.js; utils/validators/order.js|Database: default descending date/ID sort|
|Admin orders|ID, date, customer, total and status|northstar/src/features/admin/operations/AdminOrders.jsx|Browser: admin order listing/details|
|Admin orders|Complete order details|northstar/src/features/orders/Orders.jsx|Browser: order details, payment and return actions|
|Admin orders|Search, filter, sort and paginate|backend/services/customerOrderService.js; northstar/src/features/admin/operations/AdminOrders.jsx|Database: sort before skip/limit, filtering and pagination|
|Admin orders|Only permitted status transitions|backend/services/adminOrderService.js; constants/orders.js|Database: transitions and unpaid-online fulfilment rejection; browser: progression|
|Admin orders|Accept/reject returns|backend/services/returnService.js; northstar/src/features/admin/operations/AdminReturns.jsx|Database/browser: accept, reject, goods receipt and refund record|
|Inventory|Maintain product/variant stock|backend/services/inventoryService.js; stockAdjustmentService.js|Database: version guard, variants and adjustments; browser: update stock|
|Inventory|Reduce stock according to order/payment flow|backend/services/checkoutService.js|Database: atomic reservation at placement; confirmation does not deduct again|
|Inventory|Restore eligible cancelled/returned stock|backend/utils/inventory.js; services/customerOrderService.js; returnService.js|Database: cancellation/received return restoration and rollback|
|Inventory|Prevent overselling|backend/services/checkoutService.js|Database: concurrent checkouts and conditional stock decrement|
|Inventory|Prevent duplicate stock adjustments|backend/services/stockAdjustmentService.js; utils/inventory.js|Database: request-ID replay, fingerprint/version checks and restoration guard|
|Technical|Transactions for order creation and stock|backend/services/checkoutService.js; customerOrderService.js; returnService.js|Real replica-set transactions and rollback checks|
|Technical|Server-side Razorpay signature/status verification|backend/services/razorpayService.js; paymentService.js|Simulator: HMAC, payment identity, amount, currency, authorized/captured states|
|Technical|Idempotent payment and order processing|backend/models/order.js; services/checkoutService.js; paymentWebhookService.js|Database/simulator: concurrent retries, event replay, duplicate captures and refunds|
|Technical|Consistent order/payment/cancellation/refund states|backend/services/paymentService.js; refundService.js; returnService.js|Database/simulator: late captures, cancellation races, lost responses and delayed refund events|
|Technical|Customer ownership and admin authorization|backend/routes/orderRoutes.js; adminRoutes.js; middlewares/auth.js|Database: unauthenticated/wrong-role/cross-customer access rejection|
|Technical|Basic order and payment history|backend/models/order.js; northstar/src/features/orders/OrderInformation.jsx|Database: history writes; browser: dated order information|

## Verification

- 45 isolated database/integration tests passed with the existing local Razorpay HTTP simulator, including actual MongoDB transactions and rollback. Temporary test databases were removed by the suites.
- Customer orders, commerce/checkout and payment browser suites passed using fixtures and a simulated payment window.
- The simulator request log confirms the Razorpay member received order, payment, capture, refund and test-control requests. No actual Razorpay payment or refund was submitted.
- Final frontend lint and production build passed. The existing bundle-size advisory remains. Backend regression suite: 153 passed, 2 opt-in suites skipped; the relevant integration suites were explicitly enabled and run separately above.
- The simulator recorded 103 HTTP request events for this audit run.

## Remaining merchant setup

- Local backend configuration contains a Razorpay Test Mode key ID and key secret. Presence/mode were checked without disclosing values or using them for transactions.
- RAZORPAY_WEBHOOK_SECRET is absent from the local backend environment file. Add the matching merchant-dashboard webhook secret and configure a publicly reachable endpoint at /api/payments/razorpay/webhook. No secret was generated or environment setting changed during this audit.
- Actual hosted Razorpay Checkout, account capture settings and public webhook delivery still need a merchant Test Mode acceptance check. Live payments were not tested. Existing setup instructions are in docs/RAZORPAY-SETUP.md.

## Stock timing

Stock is reserved once when the local order is created: COD is confirmed immediately; online orders remain pending until verified capture. Online confirmation and payment retry reuse that reservation. Failed online orders retain it until an eligible cancellation. Cancellation and received returns restore it once inside a transaction.

## Changes from this audit

- Updated two exact sales-report summary expectations to include completedOrders and completedSales introduced by the preceding Sales Report update.
- Corrected the commerce browser cancellation check to handle both the status badge and dated information section displaying Cancelled.
- No purchasing feature rewrite was necessary. No account secrets were changed. Nothing committed or pushed.
