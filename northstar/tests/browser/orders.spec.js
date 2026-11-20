import { test, expect, ids } from "./storeFixture.js";

test("order status filtering sends the selected status to the server", async ({ page, store }) => {
  await page.goto("/orders");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("delivered");
  await expect.poll(() => store.calls.some(call => call.key === "GET /orders" && new URLSearchParams(call.search).get("status") === "delivered")).toBe(true);
});

test("wallet page shows the server balance and its empty history", async ({ page, store }) => {
  store.handlers["GET /wallet"] = ({ reply }) => reply({ walletId: "TEST-WALLET", balancePaise: 12500,
    transactions: [], total: 0, page: 1, pages: 1 });
  await page.goto("/wallet");
  await expect(page.getByText(/125\.00/).first()).toBeVisible();
});

test("cancelling an eligible order sends the reason and removes the cancellation action", async ({ page, store }) => {
  store.handlers[`POST /orders/${ids.order}/cancel`] = ({ body, reply }) => {
    store.order = { ...store.order, orderStatus: "cancelled", cancellationReason: body.reason };
    return reply({ order: store.order });
  };
  await page.goto(`/orders/${ids.order}`);
  await page.getByLabel("Cancellation reason (optional)").fill("Ordered by mistake");
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  expect(store.calls.find(call => call.key.endsWith("/cancel")).body.reason).toBe("Ordered by mistake");
});

test("a shipped order hides the cancellation form", async ({ page, store }) => {
  store.order.orderStatus = "shipped";
  await page.goto(`/orders/${ids.order}`);
  await expect(page.getByRole("heading", { name: "NS-0001", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
});
