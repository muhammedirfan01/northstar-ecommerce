import test from "node:test";
import assert from "node:assert/strict";
import SupportRequest from "../src/models/SupportRequest.js";
import { listRequests } from "../src/services/adminRequestService.js";
import { queryResult } from "./scenarioHelpers.js";

test("support-request search escapes patterns and keeps global totals distinct from filtered pages", async (t) => {
  const count = t.mock.method(SupportRequest, "countDocuments", async () => 1);
  t.mock.method(SupportRequest, "aggregate", async () => [{ _id: "open", count: 4 }, { _id: "closed", count: 2 }]);
  const chain = [];
  t.mock.method(SupportRequest, "find", () => queryResult([{ _id: "request-one", reference: "NSR-0001", status: "open" }], chain));
  const result = await listRequests({ query: { search: "NSR.*", status: "open", page: "99", limit: "5" } });
  assert.equal(count.mock.calls[0].arguments[0].$or[0].name.$regex, "NSR\\.\\*");
  assert.equal(result.body.data.pagination.page, 1);
  assert.equal(result.body.data.summary.total, 6);
  assert.equal(result.body.data.pagination.total, 1);
  assert.deepEqual(chain.find(call => call.method === "skip").args, [0]);
});

test("invalid request filters are rejected before database queries", async (t) => {
  const read = t.mock.method(SupportRequest, "countDocuments", () => { throw Error("Unexpected database query"); });
  for (const query of [{ status: "unknown" }, { page: "0" }, { limit: "51" }, { reviewedBy: "forged" }]) {
    await assert.rejects(listRequests({ query }), { status: 400 });
  }
  assert.equal(read.mock.callCount(), 0);
});
