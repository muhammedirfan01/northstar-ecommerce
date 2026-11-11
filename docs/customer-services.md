# Customer services

All amounts are integer INR paise. Existing order/address endpoints and their
authentication remain in place. Responses use `{ success, data }` or the existing
error envelope. Customer-only routes reject administrators.

- `GET /api/support`: public configured store name, email, phone and address only.
- `POST /api/support`: public, rate-limited. Accepts `name` (2–80), `email`,
  `subject` (3–120), `message` (10–3000), `requestId` (UUID). Persists a support
  request and returns 201 with `reference`; exact retries return 200. Changed
  content with the same key returns 409. It does not claim to send email.
- `GET /api/addresses/postal/:pin`: authenticated customer. Six-digit Indian PIN;
  returns canonical `state`, `districts`, and matching `cities`/localities. Unknown PIN is 400; upstream failure
  is 503. Only the PIN goes to the public postal directory. Provider:
  `https://api.postalpincode.in/pincode/{pin}` (third party, not a government API).
  Address create/edit validates city/locality against the PIN on the server;
  state is filled from the postal result. City suggestions include post-office,
  block and district names. Stale address versions still return 409.
- `GET /api/wallet?page=1&limit=10`: authenticated customer. Returns own
  `walletId`, `balancePaise`, `transactions`, `page`, `limit`, `pages`, `total`.
  Entries are newest first with deterministic ID tie-breaking before pagination.
  No public balance mutation, transfer, or top-up endpoint exists.
- Checkout preview adds `walletBalancePaise` and `paymentMethods.wallet`.
  Place order accepts `paymentMethod: "wallet"` when the balance covers the full
  total. Debit, ledger, order, cart, coupon and stock changes share one MongoDB
  transaction. Existing request ID replay prevents repeat debits. Eligible
  cancellation or completed return credits the original wallet payment exactly
  once, in the same transaction as the order and stock changes.
- Profile upload accepts JPEG/PNG/WebP filename and MIME combinations up to 2 MB,
  then decodes the actual bytes and rejects unsupported/animated/corrupt images.

Public policy pages are authored store copy and need no content database. Support
contact cards reuse existing store settings; no invented contact details appear.
