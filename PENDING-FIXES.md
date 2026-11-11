# Review fixes

- Shop subcategories show only their own names and appear only when the selected category has children. Changing the parent clears the selected child. Legacy links with a child category ID still work.
- Clear resets search, category, subcategory, price, sort and page, including unsaved form values.
- Restriction responses from any authenticated request show a dedicated modal with separate restricted and deleted messages. The page address stays unchanged and the cookie/local session are cleared only after the user chooses Continue browsing or Sign in with another account. Stale and duplicate responses cannot redirect the user. Failed acknowledgement can be retried.
- Variants require three to six owned images in the form, service and Mongoose schema. Retained images plus new uploads count; fallback product images do not. Existing variants below three images must be completed before saving their product.
- Account, customer, category and product statuses use frozen JavaScript enums. Existing database flags remain compatible.
- Admin product sorting supports `sort=status-asc` and `sort=status-desc`, independently of status filtering. Ascending order: published, out of stock, draft, unlisted, deleted. Deleted records retain their separate filter. Newest creation time and ID break ties. Ranking and pagination execute in the database.

## Run checks

Frontend: `npm run lint`, `npm run build`.

Browser regressions: install Playwright locally (`npm install --no-save playwright`), then `npm run test:regression`. Tests use installed Edge; set `BROWSER_CHANNEL=chrome` to use Chrome. `PLAYWRIGHT_PATH` can point to an existing Playwright installation. API responses are fixtures; no real accounts or uploads are used.

Backend: `npm test`. Focused review regressions: `node --test tests/pendingFixes.test.js`.

The earlier photo URL and cart quantity failures have been fixed. The checkout, orders, returns, invoices and inventory implementation and its current checks are documented in docs/WEEKLY-CHECKLIST.md.
