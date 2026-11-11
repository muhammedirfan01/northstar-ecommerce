# Admin simplification contract

Dashboard, inventory and orders retain the Customers/Products/Categories admin
shell. Dashboard adds the actual order count and shows Recent orders and Quick
access. Stock editing continues to use the existing transactional adjustment API
with `type: correction` and the difference between the requested and current
stock. Version checks, audit records and request replay protection remain.

Customer Requests is the second Customers navigation option and manages existing
SupportRequest documents submitted from the customer Support page.

- `GET /api/admin/customer-requests`: admin only, accepts page/limit/search/status
  (`open` or `closed`). Returns `requests`, global `summary`, and `pagination`.
  Newest-first sorting with ID tie-breaking happens before pagination.
- `PATCH /api/admin/customer-requests/:id`: admin only, accepts `status`, `note`
  (optional, at most 1000 characters), and `version`. Concurrent/stale updates are
  rejected with 409. Returns the updated request. Notes are internal; no email is
  sent and no account restriction is changed by resolving a support request.
- `POST /api/admin/orders/:id/mark-paid`: admin only, empty body. Records actual
  cash receipt for an active unpaid COD order. Already-paid COD retries return the
  same order without duplicate history. Cancelled/refunded orders, wallet orders,
  and Razorpay payments cannot be manually marked paid. Online verification is
  unchanged. No stock adjustment happens in this action.

New order IDs use an atomic MongoDB counter: NS-0001, NS-0002, and so on (at least
four digits). Allocation commits with the existing order/stock/cart/payment
transaction, so failed checkouts and identical replays do not consume numbers.
Startup assigns short references to old long-reference orders in date/ID order,
preserving the previous value in `legacyOrderId`. Existing short numbers are
retained. Backfill is safe to rerun and old references remain searchable. MongoDB
document IDs, route URLs, gateway receipts, payment IDs, amounts and stock stay
unchanged. No order is deleted or recreated.

Settings retains store/contact/address, delivery fees/free-delivery minimum, and
COD/online toggles. The additional-tax editor and environment/credential details
are removed from this beginner-facing page. Saving preserves the existing tax
setting; hidden settings are not silently reset.
