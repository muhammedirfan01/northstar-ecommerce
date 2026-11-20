import test from "node:test";
import assert from "node:assert/strict";
import { restrictionDetails, restrictionMessage } from "../src/api/restriction.js";
import { RestrictionCode } from "../src/status/statuses.js";

test("ordinary request errors do not open an account restriction dialog", () => {
  const failure = { response: { status: 500, data: { message: "Try again" } } };
  assert.equal(restrictionMessage(failure), "");
  assert.equal(restrictionDetails(failure), null);
});

test("blocked and deleted accounts get distinct explanations", () => {
  for (const code of [RestrictionCode.BLOCKED, RestrictionCode.DELETED]) {
    const result = restrictionDetails({ response: { data: { code } } });
    assert.equal(result.code, code);
    assert.ok(result.message.length > 0);
    assert.match(result.title, code === RestrictionCode.DELETED ? /deleted/ : /restricted/);
  }
});
