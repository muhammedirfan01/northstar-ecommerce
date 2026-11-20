import test from "node:test";
import assert from "node:assert/strict";
import { postalDirectory, validatePostalAddress } from "../src/services/postalService.js";

test("postal lookup validates external data and caches a confirmed PIN", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify([{
    Status: "Success", PostOffice: [{ Pincode: "673001", State: "Kerala", District: "Kozhikode" }],
  }])));
  const result = await postalDirectory.lookup("673001");
  assert.equal(result.state, "Kerala");
  assert.deepEqual(result.districts, ["Kozhikode"]);
  assert.deepEqual(await postalDirectory.lookup("673001"), result);
  assert.equal(request.mock.callCount(), 1);
});

test("postal provider failure reports unavailability instead of accepting an unchecked address", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw Error("fixture timeout"); });
  await assert.rejects(postalDirectory.lookup("673002"), { status: 503 });
});

test("postal provider returning data for a different PIN cannot validate the submitted PIN", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify([{
    Status: "Success", PostOffice: [{ Pincode: "999999", State: "Kerala", District: "Kozhikode" }],
  }])));
  await assert.rejects(postalDirectory.lookup("673003"), { status: 503 });
});

test("address city must match the confirmed PIN district", async (t) => {
  t.mock.method(postalDirectory, "lookup", async () => ({ state: "Kerala", districts: ["Kozhikode"] }));
  await assert.rejects(validatePostalAddress({ postalCode: "673001", city: "Mumbai", state: "Kerala" }), (error) =>
    error.status === 400 && error.code === "VALIDATION_ERROR" && Boolean(error.data.fieldErrors.city));
  const address = { postalCode: "673001", city: " kozhikode ", state: "Unverified state" };
  await validatePostalAddress(address);
  assert.equal(address.state, "Kerala");
});
