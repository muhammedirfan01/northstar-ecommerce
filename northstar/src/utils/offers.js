import { money } from "./money.js";

// A campaign label describes its own discount, not the combined saving from MRP.
export function offerLabel(offer) {
  if (!offer) return "";
  if (offer.discountType === "percentage") return offer.discountValue + "% off";
  if (Number.isFinite(offer.discountPaise)) return money(offer.discountPaise) + " off per unit";
  return "Offer applied";
}

export function selectedOffer(product, variant) {
  return variant ? variant.offer : product.offer;
}
