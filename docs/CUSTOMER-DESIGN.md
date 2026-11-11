# Customer purchasing screens and admin returns

Implemented from the supplied screenshot references using the existing React application, plain scoped CSS, shared address form, Lucide icons and existing order/payment services. No design framework or new dependency was added.

## Screens

- `/orders`: stacked order cards with date, total, shipping recipient, actual status/payment state, product imagery, invoice download, buy again, eligible cancellation and return links. Server-side product/order search, timeframe/status filters and pagination.
- `/checkout`: saved-address selection, inline add/edit with existing version protection, hosted online payment or COD, coupon application/removal, current server quote and final price breakdown. An invalid coupon can be corrected in place. Order placement retains request-ID replay protection and server price/stock checks.
- `/orders/:id`: purchased items, order progress, shipping address, payment/refund information, invoice, order/payment history and eligible actions.
- `/orders/:id/payment/success`: actual confirmed order summary, personalized thank-you, progress, invoice, products and address. COD correctly shows payment due on delivery.
- `/orders/:id/payment/failure`: actual order/payment state, retry on the same order and an entry to hosted alternative payment methods.
- `/orders/:id/return`: whole-order return/refund request, required reason, optional notes/photos, pickup address, packaging confirmation and submitted confirmation dialog.
- `/admin/returns`: matching directory layout, actual summary counts, search/status/sort/pagination and a detail dialog. Admins review evidence, accept/reject with a note, confirm goods received and process the existing refund workflow.
- `/admin/payments`: retains the matching directory and payment-detail design implemented earlier. Rechecked with the admin browser suite.

The previous storefront header/footer and older Home, Products, Categories, Customers and Dashboard screen designs were preserved. The admin shell changes are limited to new order/inventory/payment/return areas.

## Backend additions

Existing routes, middleware, models, status transitions, cancellation restrictions and payment/refund services are reused. Reason-only JSON return requests remain compatible.

Return requests additionally accept `description` (up to 500 characters), `pickupAddressId` (an owned saved address, or empty for the original delivery address) and `packagingConfirmed`. The new form requires packaging confirmation. Optional multipart `photos` supports up to 3 JPG, PNG or WebP images, up to 5 MB each. The server checks actual image bytes, single-frame format and a 16-megapixel limit; strips metadata and stores resized JPEG evidence privately, separate from order records.

Authorized evidence endpoints:

- GET `/api/orders/:id/return/photos/:photoId` for the owner
- GET `/api/admin/orders/:id/return/photos/:photoId` for administrators

Photo bytes are excluded from order/list JSON. Return metadata, photos and history commit together in a transaction. A fingerprint makes identical enhanced requests replay safely; different requests conflict. Pickup addresses are copied from owned records into an order snapshot.

`GET /api/orders` supports `timeframe=3months|6months|year`, plus product/variant-name search. Existing admin filters also accept `returnStatus=all`, which includes only real return requests. Admin order listings add return summary counts without changing existing response fields.

## Boundaries

- This is a whole-order return/refund flow. Replacement requests support the same products and options for the entire paid, delivered order. Administrators review requests, reserve replacement stock after receipt, and track dispatch and delivery. Customers can cancel before dispatch; cancellation after receipt releases reserved replacement stock and credits the wallet. After replacement delivery, customers can start a new return or replacement request; previous numbered requests are preserved in history. Partial-item returns are not enabled.
- Evidence supports images, not video.
- Payment details are entered only in Razorpay's hosted checkout. No raw card/CVV or UPI credential form was added.
- No invented courier, delivery estimate, email dispatch, refund deadline, bank debit guarantee, reservation timer, discount or settlement data was added.
- Real Razorpay payment/refund activation remains unverified and requires merchant configuration. No credentials were requested or printed.
- Browser previews use isolated fixture records and missing-image fallbacks; production thumbnails use the order's saved catalog image.

## Verification

- Frontend lint and production build pass; the existing bundle-size warning remains.
- Existing storefront and commerce browser regressions, focused admin design checks and new customer design checks pass.
- Customer checks cover inline address edit/add, invalid-coupon recovery, search/timeframe, mobile overflow, photo form submission, confirmation focus/Escape and admin return review/receipt/refund controls.
- Backend standard suite: 133 passed, 1 opt-in integration skipped, no failures.
- Replica-set integration run separately: 14 passed, no failures. Uses a fresh random test database, then drops only that database. Includes malformed-image rejection, packaging/address checks, owner/admin photo access, unrelated-user denial, retry deduplication, return summary and existing stock/refund transaction checks.
- Saved application previews were visually reviewed against the supplied references.

No real customer data or live payments were used for these checks. No commits or pushes were made. Environment files remain ignored and untracked.

## Shared admin design correction

The subsequent admin correction uses one original Customers/Products/Categories shell throughout the admin area, fills Dashboard from its existing counts/APIs and completes Coupons using the original Coupon model. The customer pages described above remain unchanged. The earlier description of an operations-only admin shell is superseded by `ADMIN-DESIGN.md`.
