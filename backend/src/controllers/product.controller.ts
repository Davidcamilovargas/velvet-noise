import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, okPaginated, created, noContent } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import * as productService from "../services/product.service";
import type { ListProductsQuery } from "../validators/product.validators";

export const listProductsHandler = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.user?.role === "ADMIN" && req.query.all === "true";
  const { data, pagination } = await productService.listProducts(req.query as unknown as ListProductsQuery, {
    includeInactive,
  });
  okPaginated(res, data, pagination);
});

export const getProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.user?.role === "ADMIN";
  const product = await productService.getProductByIdOrSlug(req.params.idOrSlug, { includeInactive });
  const related = await productService.getRelatedProducts(product);
  ok(res, { ...product, relatedProducts: related });
});

export const createProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  await writeAuditLog(req, { action: "PRODUCT_CREATED", resource: "product", resourceId: product.id, metadata: { name: product.name } });
  created(res, product);
});

export const updateProductHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  await writeAuditLog(req, { action: "PRODUCT_UPDATED", resource: "product", resourceId: req.params.id, metadata: req.body });
  ok(res, product);
});

export const setProductStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.setProductStatus(req.params.id, req.body.isActive);
  await writeAuditLog(req, {
    action: req.body.isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    resource: "product",
    resourceId: req.params.id,
  });
  ok(res, product);
});

export const deleteProductHandler = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id);
  await writeAuditLog(req, { action: "PRODUCT_DELETED", resource: "product", resourceId: req.params.id });
  noContent(res);
});
