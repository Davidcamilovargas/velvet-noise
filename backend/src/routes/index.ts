import { Router } from "express";
import { authRouter } from "./auth.routes";
import { categoryRouter } from "./category.routes";
import { productRouter } from "./product.routes";
import { cartRouter } from "./cart.routes";
import { couponRouter } from "./coupon.routes";
import { addressRouter } from "./address.routes";
import { shippingRouter } from "./shipping.routes";
import { orderRouter } from "./order.routes";
import { paymentRouter } from "./payment.routes";
import { reviewRouter } from "./review.routes";
import { adminRouter } from "./admin.routes";

/**
 * Router raíz de la API. Cada recurso se monta en su propio archivo dentro
 * de routes/ y se registra aquí. Se va completando fase a fase (auth en
 * Fase 6, productos en Fase 7, etc.).
 */
export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/coupons", couponRouter);
apiRouter.use("/addresses", addressRouter);
apiRouter.use("/shipping-methods", shippingRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/admin", adminRouter);
