import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created, noContent } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import * as categoryService from "../services/category.service";

export const listCategoriesHandler = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.user?.role === "ADMIN" && req.query.all === "true";
  const categories = await categoryService.listCategories(includeInactive);
  ok(res, categories);
});

export const createCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body);
  await writeAuditLog(req, { action: "CATEGORY_CREATED", resource: "category", resourceId: category.id, metadata: { name: category.name } });
  created(res, category);
});

export const updateCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  await writeAuditLog(req, { action: "CATEGORY_UPDATED", resource: "category", resourceId: req.params.id, metadata: req.body });
  ok(res, category);
});

export const deleteCategoryHandler = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.id);
  await writeAuditLog(req, { action: "CATEGORY_DELETED", resource: "category", resourceId: req.params.id });
  noContent(res);
});
