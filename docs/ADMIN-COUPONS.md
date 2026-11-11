# Admin coupon management contract

The existing Coupon model and checkout discount calculations are reused. All endpoints below are mounted after existing admin authentication/authorization.

- GET `/api/admin/coupons`: search by escaped code, status=all|active|scheduled|expired|inactive|exhausted|deleted, sort=newest|code|expiry, page, limit. Returns coupons, summary and pagination in the existing success/data envelope.
- POST `/api/admin/coupons`: code, discountType=percentage|fixed, discountValue (percentage or integer paise), minPurchasePaise, optional nullable maxDiscountPaise/usageLimit, ISO startDate/expiryDate, isActive. Usage starts at zero and is managed by checkout.
- PATCH `/api/admin/coupons/:id`: same editable fields plus current version. Used coupon codes cannot be renamed; limits cannot be reduced below recorded uses.
- PATCH `/api/admin/coupons/:id/status`: isActive and version.
- DELETE `/api/admin/coupons/:id`: version and confirmDelete=true. Soft-deletes the existing record so order history and cancellation usage release still work.
- POST `/api/admin/coupons/:id/restore`: version. Preserves its prior enable setting and validity rules.

Mutations use atomic version/usage checks. Conflicts return 409; invalid forms return 400. No client-supplied usedCount is accepted. Codes remain unique, including deleted records. Deleted, disabled, future, expired or exhausted coupons cannot discount a new checkout. Existing order prices are unaffected.

Dashboard uses the existing /admin/dashboard counts and existing order/inventory endpoints. No replacement store model or sample business data is introduced. All admin pages reuse the Customers/Products/Categories shell, typography, tables, pagination and form styles.
