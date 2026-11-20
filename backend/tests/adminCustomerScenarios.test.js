import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import { setCustomerStatus, deleteCustomer, restoreCustomer } from "../src/services/adminService.js";
import { ids, account, queryResult } from "./scenarioHelpers.js";

test("blocking a customer invalidates sessions once and replay does not increment again", async (t) => {
  const customer = account();
  const save = t.mock.fn(async () => customer);
  customer.save = save;
  const read = t.mock.method(User, "findOne", () => queryResult(customer));
  const request = { user: { _id: ids.order }, params: { id: ids.user }, body: { isBlocked: true } };
  assert.equal((await setCustomerStatus(request)).status, 200);
  assert.equal(customer.authVersion, 3);
  assert.equal(customer.isBlocked, true);
  await setCustomerStatus(request);
  assert.equal(save.mock.callCount(), 1);
  assert.equal(read.mock.calls[0].arguments[0].role, "customer");
});

test("an admin cannot block their own account", async (t) => {
  const read = t.mock.method(User, "findOne", () => { throw Error("Unexpected lookup"); });
  const result = await setCustomerStatus({ user: { _id: ids.user }, params: { id: ids.user }, body: { isBlocked: true } });
  assert.equal(result.status, 403);
  assert.equal(read.mock.callCount(), 0);
});

test("customer deletion and restoration each invalidate sessions and scope writes to customer accounts", async (t) => {
  const write = t.mock.method(User, "findOneAndUpdate", () => queryResult(account()));
  for (const action of [deleteCustomer, restoreCustomer]) {
    assert.equal((await action({ params: { id: ids.user } })).status, 200);
  }
  for (const call of write.mock.calls) {
    assert.equal(call.arguments[0].role, "customer");
    assert.deepEqual(call.arguments[1].$inc, { authVersion: 1 });
  }
  assert.ok(write.mock.calls[0].arguments[1].$set.deletedAt instanceof Date);
  assert.equal(write.mock.calls[1].arguments[1].$set.deletedAt, null);
});
