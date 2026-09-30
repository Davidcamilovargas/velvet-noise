import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok, created } from "../utils/apiResponse";
import { writeAuditLog } from "../utils/auditLog";
import { AppError } from "../utils/AppError";
import * as uploadService from "../services/upload.service";

export const uploadProductImagesHandler = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const images = await uploadService.uploadProductImages(req.params.id, files);
  await writeAuditLog(req, {
    action: "PRODUCT_IMAGES_UPLOADED",
    resource: "product",
    resourceId: req.params.id,
    metadata: { count: images.length },
  });
  created(res, images);
});

export const uploadProductImagesZipHandler = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw AppError.badRequest("No se recibió el archivo .zip.");
  const images = await uploadService.uploadProductImagesFromZip(req.params.id, file.buffer);
  await writeAuditLog(req, {
    action: "PRODUCT_IMAGES_UPLOADED_ZIP",
    resource: "product",
    resourceId: req.params.id,
    metadata: { count: images.length },
  });
  created(res, images);
});

export const deleteProductImageHandler = asyncHandler(async (req: Request, res: Response) => {
  await uploadService.deleteProductImage(req.params.id, req.params.imageId);
  await writeAuditLog(req, {
    action: "PRODUCT_IMAGE_DELETED",
    resource: "product",
    resourceId: req.params.id,
    metadata: { imageId: req.params.imageId },
  });
  res.status(204).send();
});

export const setPrimaryProductImageHandler = asyncHandler(async (req: Request, res: Response) => {
  await uploadService.setPrimaryProductImage(req.params.id, req.params.imageId);
  await writeAuditLog(req, {
    action: "PRODUCT_IMAGE_SET_PRIMARY",
    resource: "product",
    resourceId: req.params.id,
    metadata: { imageId: req.params.imageId },
  });
  ok(res, { success: true });
});

export const reorderProductImagesHandler = asyncHandler(async (req: Request, res: Response) => {
  await uploadService.reorderProductImages(req.params.id, req.body.imageIds);
  ok(res, { success: true });
});

export const uploadProduct360FramesHandler = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const frames = await uploadService.uploadProduct360Frames(req.params.id, files);
  await writeAuditLog(req, {
    action: "PRODUCT_360_FRAMES_UPLOADED",
    resource: "product",
    resourceId: req.params.id,
    metadata: { count: frames.length },
  });
  created(res, frames);
});
