import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import { addAddress, deleteAddress, setDefaultAddress, editAddress } from "../src/services/addressService.js";
import { postalDirectory } from "../src/services/postalService.js";
import { ids, account, queryResult } from "./scenarioHelpers.js";

const addressForm = () => ({ version: 2, fullName: "Test Customer", phoneNumber: "9876543210",
  addressLine1: "123 Main Street", city: "Kochi", state: "Kerala", postalCode: "682001" });

test("ten saved addresses prevent an eleventh address and avoid postal or database writes", async (t) => {
  t.mock.method(User, "findById", () => queryResult({ addresses: Array.from({ length: 10 }, () => ({})), addressVersion: 2 }));
  const lookup = t.mock.method(postalDirectory, "lookup", () => { throw Error("Unexpected lookup"); });
  const write = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected write"); });
  await assert.rejects(addAddress({ user: account(), body: addressForm() }), /Maximum 10/);
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(write.mock.callCount(), 0);
});

test("deleting the final address clears the default address", async (t) => {
  const user = { addresses: [{ _id: ids.address }], defaultAddressId: ids.address, addressVersion: 2 };
  t.mock.method(User, "findById", () => queryResult(user));
  const write = t.mock.method(User, "findOneAndUpdate", (filter, update) => queryResult({ ...update.$set, addressVersion: 3 }));
  const result = await deleteAddress({ user: account(), params: { id: ids.address }, body: { version: 2 } });
  assert.deepEqual(result.body.data.addresses, []);
  assert.equal(write.mock.calls[0].arguments[1].$set.defaultAddressId, null);
  assert.deepEqual(write.mock.calls[0].arguments[0].$and, [{ addressVersion: 2 }]);
});

test("default-address selection rejects an address outside the customer's address book", async (t) => {
  t.mock.method(User, "findById", () => queryResult({ addresses: [], addressVersion: 2 }));
  const write = t.mock.method(User, "findOneAndUpdate", () => { throw Error("Unexpected write"); });
  await assert.rejects(setDefaultAddress({ user: account(), params: { id: ids.address }, body: { version: 2 } }), { status: 404 });
  assert.equal(write.mock.callCount(), 0);
});

test("address edit uses postal state and reports a concurrent save conflict", async (t) => {
  t.mock.method(User, "findById", () => queryResult({ addresses: [{ _id: ids.address }], addressVersion: 2 }));
  t.mock.method(postalDirectory, "lookup", async () => ({ state: "Kerala", districts: ["Kochi"] }));
  const write = t.mock.method(User, "findOneAndUpdate", () => queryResult(null));
  await assert.rejects(editAddress({ user: account(), params: { id: ids.address }, body: { ...addressForm(), state: "Wrong state" } }), { status: 409 });
  assert.equal(write.mock.calls[0].arguments[1].$set.addresses[0].state, "Kerala");
  assert.equal(write.mock.calls[0].arguments[0].authVersion, 2);
});
