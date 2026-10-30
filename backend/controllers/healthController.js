export function checkHealth(req, res) {
  res.json({
    success: true,
    message: "Northstar API is running",
  });
}