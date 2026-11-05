import test from "node:test";
import assert from "node:assert/strict";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import ShoppingList from "../models/ShoppingList.js";
import {
  deleteCategory,
  restoreCategory,
} from "../controllers/categoryController.js";
import {
  deleteProduct,
  restoreProduct,
} from "../controllers/productController.js";
import { addToCart, checkout } from "../controllers/shoppingController.js";
import { controllerData } from "./controllerTestHelpers.js";
import { visibleCategories } from "../utils/category.js";
import { productIsAvailable } from "../utils/productAvailability.js";
import { checkProductInput } from "../utils/validators/product.js";
import { checkAddressDetails } from "../utils/validators/address.js";
const id = "111111111111111111111111";
const userId = "222222222222222222222222";
const user = {
  id: userId,
};
test("category deletion needs confirmation before accessing the database", async (t) => {
  const find = t.mock.method(Category, "findById", async () => {
    throw new Error("Must not query");
  });
  await assert.rejects(
    controllerData(deleteCategory, {
      params: {
        id,
      },
      body: {},
    }),
    {
      status: 400,
    },
  );
  assert.equal(find.mock.calls.length, 0);
});
test("category delete and restore preserve its listing choice, images and related records", async (t) => {
  const image = {
    publicId: "kept",
    url: "/category.webp",
  };
  const category = {
    _id: id,
    isListed: false,
    deletedAt: null,
    image,
    save: t.mock.fn(async () => {}),
  };
  t.mock.method(Category, "findById", async () => category);
  const removeCategories = t.mock.method(Category, "deleteMany", async () => {
    throw new Error("No hard deletion");
  });
  const removeProducts = t.mock.method(Product, "deleteMany", async () => {
    throw new Error("No hard deletion");
  });
  await controllerData(deleteCategory, {
    params: {
      id,
    },
    body: {
      confirmDelete: true,
    },
  });
  assert.ok(category.deletedAt instanceof Date);
  assert.equal(category.image, image);
  assert.equal(category.isListed, false);
  await controllerData(restoreCategory, {
    params: {
      id,
    },
  });
  assert.equal(category.deletedAt, null);
  assert.equal(category.isListed, false);
  assert.equal(category.image, image);
  assert.equal(category.save.mock.calls.length, 2);
  assert.equal(removeCategories.mock.calls.length, 0);
  assert.equal(removeProducts.mock.calls.length, 0);
});
test("product delete and restore preserve variants, images, price and stock", async (t) => {
  const product = {
    _id: id,
    images: ["kept"],
    variants: ["kept"],
    stock: 3,
    pricePaise: 10000,
    isPublished: true,
    isListed: true,
    deletedAt: null,
    save: t.mock.fn(async () => {}),
  };
  t.mock.method(Product, "findById", async () => product);
  const remove = t.mock.method(Product, "deleteMany", async () => {
    throw new Error("No hard deletion");
  });
  await controllerData(deleteProduct, {
    params: {
      id,
    },
  });
  assert.ok(product.deletedAt instanceof Date);
  await controllerData(restoreProduct, {
    params: {
      id,
    },
  });
  assert.equal(product.deletedAt, null);
  assert.equal(product.stock, 3);
  assert.equal(product.pricePaise, 10000);
  assert.deepEqual(product.images, ["kept"]);
  assert.deepEqual(product.variants, ["kept"]);
  assert.equal(product.isPublished, true);
  assert.equal(remove.mock.calls.length, 0);
});
test("restoration reports missing records", async (t) => {
  t.mock.method(Category, "findById", async () => null);
  t.mock.method(Product, "findById", async () => null);
  await assert.rejects(
    controllerData(restoreCategory, {
      params: {
        id,
      },
    }),
    {
      status: 404,
    },
  );
  await assert.rejects(
    controllerData(restoreProduct, {
      params: {
        id,
      },
    }),
    {
      status: 404,
    },
  );
});
test("deleted categories and children of deleted parents are hidden from customers", async (t) => {
  let filter;
  const rows = [
    {
      _id: id,
      isListed: true,
      deletedAt: null,
    },
    {
      _id: "deleted",
      isListed: true,
      deletedAt: new Date(),
    },
    {
      _id: "child",
      isListed: true,
      parent: {
        isListed: true,
        deletedAt: new Date(),
      },
    },
  ];
  t.mock.method(Category, "find", (value) => {
    filter = value;
    return {
      populate() {
        return this;
      },
      sort: async () => rows,
    };
  });
  assert.deepEqual(
    (await visibleCategories()).map((row) => row._id),
    [id],
  );
  assert.deepEqual(filter, {
    isListed: true,
    deletedAt: null,
  });
});
function productFixture() {
  const model = new Product({
    _id: id,
    name: "Laptop",
    pricePaise: 10000,
    stock: 3,
    isPublished: true,
    isListed: true,
    images: [],
    variants: [],
  });
  return {
    ...model.toObject(),
    variants: model.variants,
    category: {
      _id: id,
      name: "Laptops",
      isListed: true,
      deletedAt: null,
      parent: null,
    },
  };
}
test("availability excludes deleted records at every level and requires real stock", () => {
  const product = productFixture();
  assert.equal(productIsAvailable(product), true);
  for (const level of [product, product.category]) {
    level.deletedAt = new Date();
    assert.equal(productIsAvailable(product), false);
    level.deletedAt = null;
  }
  product.category.parent = {
    isListed: true,
    deletedAt: new Date(),
  };
  assert.equal(productIsAvailable(product), false);
  product.category.parent.deletedAt = null;
  assert.equal(productIsAvailable(product), true);
  for (const stock of [0, -1, undefined, NaN, Infinity]) {
    product.stock = stock;
    assert.equal(productIsAvailable(product), false);
  }
});
function shoppingDatabase(t, quantity = 1) {
  const product = productFixture();
  const list = new ShoppingList({
    userId,
    cart: quantity
      ? [
          {
            productId: id,
            quantity,
          },
        ]
      : [],
    wishlist: [id],
  });
  let requestedUser;
  t.mock.method(ShoppingList, "findOne", async (filter) => {
    requestedUser = filter.userId;
    return list;
  });
  const save = t.mock.method(ShoppingList.prototype, "save", async function () {
    return this;
  });
  t.mock.method(Product, "find", () => ({
    populate: async () => [product],
  }));
  t.mock.method(Product, "findById", () => ({
    populate: async () => product,
  }));
  return {
    product,
    list,
    save,
    requestedUser: () => requestedUser,
  };
}
test("checkout recomputes the current backend price and rejects a stale total", async (t) => {
  const db = shoppingDatabase(t);
  await assert.rejects(
    controllerData(checkout, {
      user,
      body: {
        expectedTotalPaise: 9000,
      },
    }),
    (error) => error.status === 409 && error.data.totalPaise === 10000,
  );
  const cart = await controllerData(checkout, {
    user,
    body: {
      expectedTotalPaise: 10000,
    },
  });
  assert.equal(cart.canCheckout, true);
  assert.equal(cart.totalPaise, 10000);
  assert.equal(db.requestedUser(), userId);
  assert.equal(db.save.mock.calls.length, 0);
});
test("checkout rejects an empty cart", async (t) => {
  shoppingDatabase(t, 0);
  await assert.rejects(
    controllerData(checkout, {
      user,
      body: {
        expectedTotalPaise: 0,
      },
    }),
    {
      status: 400,
    },
  );
});
test("checkout rechecks stock and parent-category deletion", async (t) => {
  const db = shoppingDatabase(t, 2);
  db.product.stock = 1;
  await assert.rejects(
    controllerData(checkout, {
      user,
      body: {
        expectedTotalPaise: 20000,
      },
    }),
    {
      status: 409,
    },
  );
  db.product.stock = 3;
  db.product.category.parent = {
    isListed: true,
    deletedAt: new Date(),
  };
  await assert.rejects(
    controllerData(checkout, {
      user,
      body: {
        expectedTotalPaise: 20000,
      },
    }),
    {
      status: 409,
    },
  );
});
test("adding to cart removes the wishlist item and uses backend prices", async (t) => {
  const db = shoppingDatabase(t, 0);
  const cart = await controllerData(addToCart, {
    user,
    body: {
      productId: id,
      variantId: null,
      quantity: 2,
    },
  });
  assert.equal(cart.totalPaise, 20000);
  assert.equal(db.list.wishlist.length, 0);
  assert.equal(db.save.mock.calls.length, 1);
});
test("adding to cart rejects quantity above stock and deleted products before saving", async (t) => {
  const db = shoppingDatabase(t, 2);
  const req = {
    user,
    body: {
      productId: id,
      variantId: null,
      quantity: 2,
    },
  };
  await assert.rejects(controllerData(addToCart, req), {
    status: 409,
  });
  db.product.deletedAt = new Date();
  await assert.rejects(controllerData(addToCart, req), {
    status: 409,
  });
  assert.equal(db.save.mock.calls.length, 0);
  assert.equal(db.list.wishlist.length, 1);
});
test("plain validators leave the submitted arrays untouched", () => {
  const input = {
    name: "Laptop",
    description: "A lightweight laptop.",
    categoryId: id,
    price: "100",
    stock: "3",
    isPublished: true,
    isListed: true,
    highlights: [" Fast "],
    specifications: [" Good screen "],
    retainedImageIds: [],
    quickSpecs: [
      {
        label: " CPU ",
        value: " Fast ",
      },
    ],
  };
  const before = structuredClone(input);
  const result = checkProductInput(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.highlights, ["Fast"]);
  assert.equal(result.quickSpecs[0].label, "CPU");
});
test("address validation preserves Indian phone normalization and field limits", () => {
  const input = {
    fullName: " Asha Devi ",
    phoneNumber: "9876543210",
    addressLine1: "123 Main Road",
    city: "Kochi",
    state: "Kerala",
    postalCode: "682001",
    version: 0,
  };
  const parsed = checkAddressDetails(input);
  assert.equal(parsed.phoneNumber, "+919876543210");
  assert.equal(parsed.fullName, "Asha Devi");
  assert.equal(parsed.label, "Home");
  for (const change of [
    {
      phoneNumber: "123",
    },
    {
      postalCode: "000000",
    },
    {
      version: -1,
    },
    {
      userId: "someone else",
    },
  ]) {
    assert.throws(() =>
      checkAddressDetails({
        ...input,
        ...change,
      }),
    );
  }
});
