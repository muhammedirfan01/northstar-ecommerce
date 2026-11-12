import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import SupportRequest from "../src/models/SupportRequest.js";
import { updateRequest } from "../src/services/adminRequestService.js";

afterEach(() => mock.restoreAll());
const id = "111111111111111111111111";
function input(status = "closed", version = 0) {
  return { params: { id }, user: { id }, body: { status, version } };
}

test("support status changes need no note and retain review tracking and version protection", async () => {
  let version = 0;
  mock.method(SupportRequest, "findOneAndUpdate", async (filter, changes) => {
    if (version === 0) assert.ok(filter.$or);
    else assert.equal(filter.__v, version);
    assert.equal(changes.$set.resolutionNote, undefined);
    assert.equal(changes.$set.reviewedBy, id);
    assert.ok(changes.$set.reviewedAt instanceof Date);
    version++;
    return { _id: id, reference: "REQ-10001", ...changes.$set,
      resolutionNote: "An older saved note", __v: version };
  });
  for (const status of ["in_progress", "closed", "open"]) {
    const result = await updateRequest(input(status, version));
    assert.equal(result.status, 200);
    assert.equal(result.body.data.request.status, status);
    assert.equal(result.body.data.request.reference, "REQ-10001");
    assert.equal(result.body.data.request.resolutionNote, undefined);
    assert.equal(result.body.data.request.version, version);
  }
});

test("a stale support-request version still reports a conflict", async () => {
  mock.method(SupportRequest, "findOneAndUpdate", async () => null);
  mock.method(SupportRequest, "exists", async () => ({ _id: id }));
  await assert.rejects(updateRequest(input()), { status: 409 });
});

test("an invalid support status is rejected before persistence", async () => {
  const update = mock.method(SupportRequest, "findOneAndUpdate", () => { throw Error("must not save"); });
  await assert.rejects(updateRequest(input("invalid")), { status: 400 });
  assert.equal(update.mock.calls.length, 0);
});
