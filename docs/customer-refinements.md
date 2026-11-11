# Customer navigation, support, city validation and checkout fixes

- Customer navigation is Home, Categories, Shop Now, followed by the existing
  category shortcuts and Support. Categories closes on outside pointer clicks,
  keyboard focus leaving the menu, Escape, or category selection.
- Support keeps the message form and configured contact information, with a
  compact desktop layout. Removed the introductory sentence and the repeated top
  labels. Mobile content stacks naturally; no form fields are clipped to force a
  fixed viewport height.
- Customer profile menu includes Support, Shipping Policy, Terms & Conditions and
  Privacy Policy. It scrolls on shorter screens.
- Postal lookup adds `cities`: post-office names, blocks and districts associated
  with the exact PIN. City/locality is checked on the client and server using one
  shared normalizer, including common alternative city names. Suggestions are
  shown in the city input. A wrong city is a 400 validation error for `city`.
  State is filled from the postal result; it is no longer a PIN-matching user
  validation. Provider failure remains 503 and invalid PINs remain 400.
- The local Orders collection had a legacy non-sparse unique `orderNumber` index.
  Current checkout writes `orderId`, so only one order without the obsolete field
  could exist. Startup and checkout preparation now remove only that obsolete
  unique index, after verifying the current unique `orderId` index. Other order,
  request replay, and payment indexes are preserved. No order is deleted or
  recreated and no stock/payment data is changed by this index repair.

Regression tests reproduce the legacy index collision in a fresh test database
and check that subsequent COD orders succeed with sequential references, that
replays do not create duplicates, and that invalid cities cannot bypass the API.
