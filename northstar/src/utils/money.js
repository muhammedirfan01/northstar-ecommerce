export function money(paise) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
}
