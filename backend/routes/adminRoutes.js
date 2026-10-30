import { Router } from "express";
import { requireAuth, requireAdmin, publicUser } from "../middlewares/auth.js";
import {
  getCustomers, setCustomerStatus,
  getCustomer, getCustomerPhoto, deleteCustomer, restoreCustomer,
} from "../controllers/adminController.js";
import {
  validateCustomerQuery, validateCustomerStatus,
  validateCustomerId, validateCustomerPhoto,
} from "../middlewares/validateAdmin.js";

const router = Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(requireAuth, requireAdmin);
router.get("/me", (req, res) =>
  res.json({ success: true, data: { user: publicUser(req.user) } })
);
router.get("/customers", validateCustomerQuery, getCustomers);
router.get("/customers/:id", validateCustomerId, getCustomer);
router.get("/customers/:id/photo", validateCustomerId, validateCustomerPhoto, getCustomerPhoto);
router.delete("/customers/:id", validateCustomerId, deleteCustomer);
router.post("/customers/:id/restore", validateCustomerId, restoreCustomer);
router.patch(
  "/customers/:id/status",
  validateCustomerStatus,
  setCustomerStatus
);
export default router;
