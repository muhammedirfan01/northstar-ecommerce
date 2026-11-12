import test from "node:test";
import assert from "node:assert/strict";
import Product from "../src/models/Product.js";
import { calculateOrder } from "../src/services/orderService.js";

for (const [subtotal, shipping] of [[49000, 5000], [50000, 5000], [50100, 0]]) {
  test(`checkout subtotal ${subtotal} uses shipping ${shipping} from shared store constants`, async (t) => {
    const id = "111111111111111111111111";
    t.mock.method(Product, "find", () => ({ session() { return this; }, populate: async () => [{
      _id: id, name: "Headphones", isListed: true, isPublished: true,
      category: { isListed: true }, pricePaise: subtotal, stock: 1, variants: [], images: [],
    }] }));
    const result = await calculateOrder({
      user: { addresses: { id: () => ({ fullName: "Test Customer", phoneNumber: "+919876543210",
        addressLine1: "Test Road", city: "Kochi", state: "Kerala", postalCode: "682001" }) } },
      body: { addressId: id, buyNow: { productId: id, quantity: 1 } },
      enforceAvailability: true,
    });
    assert.equal(result.status, 200);
    assert.equal(result.checkout.shippingCharge, shipping);
    assert.equal(result.checkout.tax, 0);
    assert.equal(result.checkout.totalAmount, subtotal + shipping);
  });
}
