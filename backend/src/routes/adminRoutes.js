import { listRequests, updateRequest } from "../controllers/adminRequestController.js";
import adminBusinessRoutes from "./adminBusinessRoutes.js";
import adminCouponRoutes from "./adminCouponRoutes.js";
import adminOrderRoutes from "./adminOrderRoutes.js";
import noCache from "../middlewares/noCache.js";
import { Router } from "express";
import adminCatalogRoutes from "./adminCatalogRoutes.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import {
  getDashboard,
  getCustomers,
  setCustomerStatus,
  getCustomer,
  getCustomerPhoto,
  deleteCustomer,
  restoreCustomer,
} from "../controllers/adminController.js";
const router = Router();
router.use(noCache);
router.use(requireAuth, requireAdmin);
router.get("/dashboard", getDashboard);
router.get("/customer-requests", listRequests);
router.patch("/customer-requests/:id", updateRequest);
router.get("/customers", getCustomers);
router.get("/customers/:id", getCustomer);
router.get("/customers/:id/photo", getCustomerPhoto);
router.delete("/customers/:id", deleteCustomer);
router.post("/customers/:id/restore", restoreCustomer);
router.patch("/customers/:id/status", setCustomerStatus);
router.use(adminBusinessRoutes);
router.use(adminCouponRoutes);
router.use(adminOrderRoutes);
router.use(adminCatalogRoutes);
export default router;
