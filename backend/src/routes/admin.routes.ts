import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { getDashboardHandler } from "../controllers/dashboard.controller";
import { listInventoryHandler, adjustInventoryHandler, listInventoryMovementsHandler } from "../controllers/inventory.controller";
import { inventoryIdParamSchema, listInventoryQuerySchema, adjustInventorySchema } from "../validators/inventory.validators";
import { listCustomersHandler, getCustomerHandler, setCustomerStatusHandler } from "../controllers/customer.controller";
import { customerIdParamSchema, listCustomersQuerySchema, setCustomerStatusSchema } from "../validators/customer.validators";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settings.controller";
import { updateSettingsSchema } from "../validators/settings.validators";
import { listReviewsForAdminHandler, setReviewStatusHandler, deleteReviewHandler } from "../controllers/review.controller";
import { listAdminReviewsQuerySchema, reviewIdParamSchema, setReviewStatusSchema } from "../validators/review.validators";
import { listAuditLogsHandler } from "../controllers/auditLogQuery.controller";

/**
 * Espacio de rutas exclusivo del panel administrativo. Todo lo que cuelgue
 * de aquí exige sesión + rol ADMIN — se aplica una sola vez para todo el
 * router en vez de repetirlo en cada endpoint. Productos, categorías y
 * cupones tienen su gestión admin en sus propios routers (product.routes.ts,
 * category.routes.ts, coupon.routes.ts) porque comparten el mismo recurso
 * público (GET) con endpoints de escritura solo-admin al lado; lo que vive
 * aquí son recursos que SOLO existen para el panel admin.
 */
export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/dashboard", getDashboardHandler);

adminRouter.get("/inventory", validate({ query: listInventoryQuerySchema }), listInventoryHandler);
adminRouter.get("/inventory/:id/movements", validate({ params: inventoryIdParamSchema }), listInventoryMovementsHandler);
adminRouter.patch(
  "/inventory/:id/adjust",
  validate({ params: inventoryIdParamSchema, body: adjustInventorySchema }),
  adjustInventoryHandler
);

adminRouter.get("/customers", validate({ query: listCustomersQuerySchema }), listCustomersHandler);
adminRouter.get("/customers/:id", validate({ params: customerIdParamSchema }), getCustomerHandler);
adminRouter.patch(
  "/customers/:id/status",
  validate({ params: customerIdParamSchema, body: setCustomerStatusSchema }),
  setCustomerStatusHandler
);

adminRouter.get("/settings", getSettingsHandler);
adminRouter.put("/settings", validate({ body: updateSettingsSchema }), updateSettingsHandler);

adminRouter.get("/reviews", validate({ query: listAdminReviewsQuerySchema }), listReviewsForAdminHandler);
adminRouter.patch(
  "/reviews/:id/status",
  validate({ params: reviewIdParamSchema, body: setReviewStatusSchema }),
  setReviewStatusHandler
);
adminRouter.delete("/reviews/:id", validate({ params: reviewIdParamSchema }), deleteReviewHandler);

adminRouter.get("/audit-logs", listAuditLogsHandler);
