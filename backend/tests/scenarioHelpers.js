// Test doubles for database boundaries. Services and validators remain real.
export const ids = {
  user: "111111111111111111111111",
  product: "222222222222222222222222",
  order: "333333333333333333333333",
  address: "444444444444444444444444",
  challenge: "555555555555555555555555",
};

export function queryResult(value, calls = []) {
  const query = {
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  for (const method of ["select", "session", "populate", "sort", "skip", "limit", "lean"]) {
    query[method] = (...args) => {
      calls.push({ method, args });
      return query;
    };
  }
  return query;
}

export function account(changes = {}) {
  return { _id: ids.user, id: ids.user, name: "Test Customer", email: "customer@example.test",
    role: "customer", isEmailVerified: true, isBlocked: false, deletedAt: null,
    authVersion: 2, ...changes };
}

export function savedOrder(changes = {}) {
  return { _id: ids.order, orderId: "NS-0001", userId: ids.user, items: [],
    shippingAddress: { name: "Test Customer" }, totalAmount: 15000,
    paymentMethod: "cod", paymentStatus: "pending", orderStatus: "confirmed",
    returnRequest: { status: "none" }, refund: { status: "none" },
    statusHistory: [], paymentHistory: [], __v: 3, ...changes };
}

export function testEnvironment(t, values) {
  const previous = process.env;
  process.env = { ...previous, ...values };
  t.after(() => { process.env = previous; });
}
