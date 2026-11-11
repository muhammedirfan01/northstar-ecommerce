import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  postalDirectory,
  validatePostalAddress,
  normalizedState,
} from "../services/postalService.js";
import { sendMessage } from "../services/supportService.js";

test("postal directory uses HTTP; validates missing PINs, city mismatches and upstream failure", async () => {
  const originalEnv = process.env.NODE_ENV;
  let mode = "success",
    requests = 0;
  const server = createServer((req, res) => {
    requests++;
    const pin = req.url.split("/").pop();
    res.setHeader("Content-Type", "application/json");
    if (mode === "unavailable") {
      res.statusCode = 503;
      res.end("{}");
      return;
    }
    if (mode === "malformed") {
      res.end(
        JSON.stringify([
          {
            Status: "Success",
            PostOffice: [{ State: "Kerala", Pincode: "000000" }],
          },
        ]),
      );
      return;
    }
    res.end(
      JSON.stringify([
        {
          Status: mode === "missing" ? "Error" : "Success",
          PostOffice:
            mode === "missing"
              ? null
              : [
                  {
                    Name: "Kochi",
                    Block: "Kochi",
                    State: "Kerala",
                    District: "Ernakulam",
                    Pincode: pin,
                  },
                ],
        },
      ]),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NODE_ENV = "test";
  process.env.POSTAL_TEST_ORIGIN = `http://127.0.0.1:${server.address().port}`;
  try {
    const location = await postalDirectory.lookup("682001");
    assert.deepEqual(location, {
      state: "Kerala",
      districts: ["Ernakulam"],
      cities: ["Kochi", "Ernakulam"],
    });
    await postalDirectory.lookup("682001");
    assert.equal(requests, 1, "Successful lookup should be cached");
    const details = {
      postalCode: "682001",
      state: "KERALA",
      city: "Fort Kochi",
    };
    await validatePostalAddress(details);
    assert.equal(details.state, "Kerala");
    assert.equal(
      details.city,
      "Fort Kochi",
      "Do not replace locality with district",
    );
    await assert.rejects(
      validatePostalAddress({
        postalCode: "682001",
        state: "Tamil Nadu",
        city: "Chennai",
      }),
      (error) => error.status === 400 && Boolean(error.data.fieldErrors.city),
    );
    await assert.rejects(postalDirectory.lookup("../../secret"), {
      status: 400,
    });
    assert.equal(requests, 1);
    const correctCity = {
      postalCode: "682001",
      state: "Tamil Nadu",
      city: "Cochin",
    };
    await validatePostalAddress(correctCity);
    assert.equal(
      correctCity.state,
      "Kerala",
      "State is filled from the PIN, not checked as a customer-entered match",
    );
    mode = "missing";
    await assert.rejects(postalDirectory.lookup("999999"), { status: 400 });
    mode = "unavailable";
    await assert.rejects(postalDirectory.lookup("682002"), { status: 503 });
    mode = "success";
    assert.equal(
      (await postalDirectory.lookup("682002")).state,
      "Kerala",
      "Failure must not poison the cache",
    );
    mode = "malformed";
    await assert.rejects(postalDirectory.lookup("682003"), { status: 503 });
    assert.equal(normalizedState("Orissa"), normalizedState("Odisha"));
  } finally {
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
    delete process.env.POSTAL_TEST_ORIGIN;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("support validation rejects invalid requests before persistence", async () => {
  const input = {
    name: "Asha Devi",
    email: "asha@example.test",
    subject: "Order update",
    message: "Please help me with my order.",
    requestId: "12345678-1234-4234-8234-123456789abc",
  };
  await assert.rejects(
    sendMessage({ body: { ...input, email: "not-an-email" } }),
    { status: 400 },
  );
  await assert.rejects(
    sendMessage({ body: { ...input, message: "short" } }),
    /Invalid message/,
  );
  await assert.rejects(sendMessage({ body: { ...input, requestId: "bad" } }), {
    status: 400,
  });
  await assert.rejects(
    sendMessage({ body: { ...input, status: "closed" } }),
    /Unknown form field/,
  );
});
