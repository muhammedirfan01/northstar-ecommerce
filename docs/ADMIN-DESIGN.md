# NORTHSTAR admin design

Dashboard, Orders, Inventory, Payments, Returns, Coupons, Settings, Offers & Campaigns and Sales Report now use the existing Customers, Products and Categories admin design. The screenshot references guide page structure only. The separate operations shell/top search bar has been removed.

## Existing design reused

- The original NORTHSTAR brand, sidebar, background, type sizes, colours and spacing.
- Existing `cm-*` management headings, toolbars, tables, badges, pagination and `catalog-*` forms/buttons.
- A shared native admin dialog with the catalog modal styling. Earlier Customers, Products and Categories screens retain their design.
- Normal admin navigation on every page, with working links to all management sections.

## Dashboard

The placeholder has been replaced with the original backend's customer, product, category and published/listed-product counts. Recent orders, stock alerts and management shortcuts use existing order/inventory APIs. Empty/loading/error states and refresh are included. No sample business records or replacement dashboard data model are added.

## Orders and inventory

Lists, filters, exports, pagination, stock adjustment forms and payment/return dialogs retain the working API/service/model logic and now share the older admin styling. Admin order details use matching product tables, customer/address/payment panels, processing controls and history sections. Existing cancellation, return, refund and reconciliation actions are retained.

## Coupons

Coupon management reuses `backend/models/Coupon.js`, which checkout already uses. It supports creation/editing, percentage/fixed discounts, minimum purchase, optional discount/usage caps, dates, enable/disable, search/status/sort/pagination and soft deletion/restoration. Checkout excludes deleted coupons; order history and cancellation quota release are preserved. Current version/usage checks prevent stale edits. See `ADMIN-COUPONS.md` for API details.

## Settings, offers and sales

Settings stores invoice identity and checkout preferences, including delivery rates, extra tax and payment-method availability. Scheduled offers use existing products/categories and apply the best discount per item at checkout, followed by any coupon. Saved order prices and invoice details remain snapshots. Admin writes use versions to reject stale edits.

Sales reports show actual order cohorts, current collections/completed refunds, daily or monthly trends, filters, pagination and CSV downloads. No demo business data is inserted. See `ADMIN-BUSINESS.md` for contracts, calculation rules and reporting boundaries.

The customer purchasing designs and payment integration were preserved. Checkout reflects saved payment availability and shows applied offers. No real credentials or store records were used by tests, and no commit/push was made.
