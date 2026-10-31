import User from "../models/User.js";
import Order from "../models/Order.js";

export async function dashboardSummary() {
  const [customers, orders, fulfilled, pending] = await Promise.all([
    User.countDocuments({ role: "customer", deletedAt: null }),
    Order.countDocuments({}),
    Order.countDocuments({ status: "delivered" }),
    Order.countDocuments({ status: { $in: ["pending", "confirmed"] } }),
  ]);
  return { customers, orders, fulfilled, pending };
}
