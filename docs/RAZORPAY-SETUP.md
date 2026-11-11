# Activate Razorpay

All application code is implemented. Merchant credentials, account activation and a public webhook still belong to your Razorpay account and deployment.

## 1. Add backend credentials

Add these three entries to your existing `backend/.env`, using the blank `backend/razorpay.env.example` as a reference. Keep the existing database, login and other settings.

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Razorpay Standard Checkout uses a Key ID and Key Secret. The webhook secret is a separate value you choose when creating the webhook in the Razorpay Dashboard. There is no separate OAuth client secret required for this integration. Start with Test Mode keys. The browser receives only the public Key ID from your backend; never add the Key Secret or webhook secret to a `VITE_` variable.

Restart the backend after adding or changing credentials. COD continues working without Razorpay keys. Online order creation rejects missing keys before stock/cart changes; existing orders also reject unconfigured setup without becoming stuck.

## 2. Configure the webhook

In the matching Razorpay Test Mode dashboard, add your publicly reachable backend HTTPS address followed by:

`/api/payments/razorpay/webhook`

For example, if the backend is deployed at your own API host, use that host with the path above. Localhost is not reachable from Razorpay; use a deployment or your own HTTPS tunnel for merchant testing. Set the same webhook secret in the dashboard and backend environment.

Enable these events:

- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.processed`
- `refund.failed`

The raw request body and Razorpay signature are verified before processing. Event IDs/payload digests deduplicate deliveries; order/refund updates are independently idempotent. Unknown event types are acknowledged without changing orders.

## 3. Capture and recovery

The backend checks the provider payment's ID, owning gateway order, INR currency and exact amount. An authorized payment on an active order is captured server-side; a capture timeout is checked against the provider before it can be reported as successful. The merchant account's automatic capture may race with this safely: the backend fetches the current provider state if the capture request was already completed.

Captured payments confirm the existing order without reducing inventory again. Missing browser callbacks can be recovered by a webhook, retry, the customer's **Check payment status** action, or the administrator's **Reconcile payment** action. None of these creates another local order. Reconciliation does not create a payable gateway order.

Cancelled orders are not intentionally captured. A capture that wins a cancellation race stays attached to the cancelled order and creates a refund due. An uncertain order-creation response is recovered by its original receipt. If the provider cannot resolve that receipt unambiguously, the system stops further payable-order creation and reports reconciliation is needed; it does not blindly create another payable order.

Refunds initiated by an administrator reuse the original payment and a stable refund idempotency key. Pending, failed and completed refunds remain distinct. A delayed failure event cannot undo a completed refund. COD refunds are recorded manually only after staff have returned the cash and supplied its reference.

## 4. Merchant acceptance checks after adding keys

Use Razorpay Test Mode and disposable test products/accounts:

1. Place a COD order and verify the order ID, stock reduction, totals and invoice.
2. Place an online order and complete a Razorpay test payment. Check that it becomes paid/confirmed with one stock deduction.
3. Cancel/dismiss or fail a payment, then retry from that order. Confirm that the local and gateway order IDs are reused.
4. Close the customer page during payment. Check status from order details and verify webhook recovery.
5. Cancel an eligible order and verify stock is restored once. Process its refund and check the actual provider status.
6. Deliver an order, request a return, accept it and confirm received goods. Verify one stock restoration and the refund workflow.
7. Send/replay the dashboard webhook test events and confirm duplicate deliveries do not duplicate history or stock changes.

The automated tests cover these code paths with isolated databases, a local Razorpay API simulator and a simulated hosted browser window. Real merchant Test Mode and live transactions cannot be claimed verified until your account and public webhook are configured.

## 5. Go live

Complete your merchant account activation, switch to the matching Live Mode Key ID/Secret, configure the webhook in Live Mode with its matching secret, restart the backend and perform your merchant acceptance checks. Enable only payment methods available on your account. Keep HTTPS, the existing production cookie configuration and the configured frontend origin in place.

The app reserves stock when an order is placed. Unpaid orders retain that reservation until an eligible cancellation; no automatic expiration policy was introduced. Existing shipping rules and zero-tax configuration are preserved.

## Local automated checks

- Frontend: `npm run lint`, `npm run build`, `npm run test:regression`, `npm run test:payments`, `npm run test:admin-design`, `npm run test:customer-design`. Run browser suites sequentially because they share Vite's local dependency cache.
- Backend: `npm test`.
- Full isolated transaction/provider suite: start `postman simulation run postman/simulations/payments.sim.yaml --port 4519 --no-history --output ndjson` from the project root. In another terminal, set `NORTHSTAR_INTEGRATION=1`, `NORTHSTAR_POSTMAN=1`, `RAZORPAY_TEST_URL=http://127.0.0.1:4519/razorpay`, then run `node --test tests/orderTransactions.test.js` from backend.

The integration suite creates and deletes only a fresh `northstar_codex_test_*` database and supplies fixture keys in its own process. Do not copy fixture credentials into the real environment. The test-only provider URL override is ignored outside NODE_ENV=test.

## Provider references checked

- [Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Capture an authorized payment](https://razorpay.com/docs/api/payments/capture/)
- [Fetch orders by receipt](https://razorpay.com/docs/api/orders/fetch-all/)
- [Webhook validation, retries and event order](https://razorpay.com/docs/webhooks/validate-test/)
- [Refund idempotency](https://github.com/razorpay/markdown-docs/blob/master/api/refunds/normal-refunds-idempotent.md)
