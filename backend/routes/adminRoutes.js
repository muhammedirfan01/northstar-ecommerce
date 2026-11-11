import { listRequests, updateRequest } from "../controllers/adminRequestController.js";
import businessAdminRoutes from "./businessAdminRoutes.js";
import couponAdminRoutes from "./couponAdminRoutes.js";
import orderAdminRoutes from "./orderAdminRoutes.js";
import noCache from "../middlewares/noCache.js";
import { getCurrentAdmin } from "../controllers/adminController.js";
import { Router } from "express";
import { getDashboard } from "../controllers/adminController.js";
import catalogAdminRoutes from "./catalogAdminRoutes.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import {
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
router.get("/me", getCurrentAdmin);
router.get("/dashboard", getDashboard);
router.get("/customer-requests", listRequests);
router.patch("/customer-requests/:id", updateRequest);
router.get("/customers", getCustomers);
router.get("/customers/:id", getCustomer);
router.get("/customers/:id/photo", getCustomerPhoto);
router.delete("/customers/:id", deleteCustomer);
router.post("/customers/:id/restore", restoreCustomer);
router.patch("/customers/:id/status", setCustomerStatus);
router.use(businessAdminRoutes);
router.use(couponAdminRoutes);
router.use(orderAdminRoutes);
router.use(catalogAdminRoutes);
export default router;
