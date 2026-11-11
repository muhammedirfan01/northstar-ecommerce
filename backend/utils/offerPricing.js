// Preserve catalog base prices for stock comparisons; only discounts change totals.
export function bestOffer(
  product,
  unitPrice,
  quantity,
  offers = [],
  now = new Date(),
) {
  let best = null,
    amount = 0;
  for (const o of offers) {
    if (
      !o.isActive ||
      +new Date(o.startDate) > +now ||
      +new Date(o.expiryDate) <= +now
    )
      continue;
    const matches =
      o.scope === "all" ||
      (o.scope === "product" && String(o.targetId) === String(product._id)) ||
      (o.scope === "category" &&
        [product.category?._id, product.category?.parent?._id]
          .filter(Boolean)
          .some((id) => String(id) === String(o.targetId)));
    if (!matches) continue;
    const perUnit =
      o.discountType === "percentage"
        ? Math.floor((unitPrice * o.discountValue) / 100)
        : o.discountValue;
    const discount = Math.min(unitPrice, perUnit) * quantity;
    if (
      discount > amount ||
      (discount > 0 && discount === amount && String(o._id) < String(best?._id))
    ) {
      best = o;
      amount = discount;
    }
  }
  return best
    ? {
        campaignId: best._id,
        name: best.name,
        productId: product._id,
        discount: amount,
      }
    : null;
}
