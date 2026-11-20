import { test, expect } from "./storeFixture.js";

test("guest checkout preserves the requested destination when opening sign-in", async ({ page, store }) => {
  store.user = null;
  await page.goto("/checkout?productId=222222222222222222222222&quantity=2");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/signin=1/);
  const next = new URL(page.url()).searchParams.get("next");
  expect(next).toBe("/checkout?productId=222222222222222222222222&quantity=2");
});

test("rejected login shows the server message and keeps the sign-in form available", async ({ page, store }) => {
  store.user = null;
  store.handlers["POST /auth/login"] = ({ route }) => route.fulfill({ status: 401, json: { message: "Invalid email or password" } });
  await page.goto("/?signin=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email Address").fill("customer@example.test");
  await dialog.getByPlaceholder("Enter your password").fill("WrongPassword123");
  await dialog.getByRole("button", { name: "SIGN IN", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Invalid email or password");
  await expect(dialog.getByRole("button", { name: "SIGN IN", exact: true })).toBeEnabled();
});

test("signup sends password confirmation and displays the server's validation message", async ({ page, store }) => {
  store.user = null;
  store.handlers["POST /auth/register"] = ({ route }) => route.fulfill({
    status: 400,
    json: { message: "Passwords do not match." },
  });
  await page.goto("/?signin=1");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sign up", exact: true }).click();
  await dialog.getByPlaceholder("e.g. Asha Devi").fill("Asha Devi");
  await dialog.getByPlaceholder("you@example.com").fill("asha@example.com");
  await dialog.getByPlaceholder("Create a password").fill("Password8");
  await dialog.getByPlaceholder("Re-enter your password").fill("Different8");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "CREATE ACCOUNT" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(store.calls.find(({ key }) => key === "POST /auth/register")?.body).toEqual({
    name: "Asha Devi",
    email: "asha@example.com",
    password: "Password8",
    confirmPassword: "Different8",
    acceptedTerms: true,
  });
});

test("customer accounts are redirected away from the admin route", async ({ page, store }) => {
  expect(store.user.role).toBe("customer");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Power Meets Performance" })).toBeVisible();
});

test("successful sign-in returns the customer to the requested checkout", async ({ page, store }) => {
  const customer = store.user;
  store.user = null;
  store.handlers["POST /auth/login"] = ({ reply }) => {
    store.user = customer;
    return reply({ user: customer });
  };
  await page.goto("/?signin=1&next=%2Fcheckout");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email Address").fill(customer.email);
  await dialog.getByLabel("Password", { exact: true }).fill("Password123");
  await dialog.getByRole("button", { name: "SIGN IN", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("button", { name: "Place COD order" })).toBeEnabled();
});
