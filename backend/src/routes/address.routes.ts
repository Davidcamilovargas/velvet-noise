import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { addressBodySchema, updateAddressSchema, addressIdParamSchema } from "../validators/address.validators";
import {
  listAddressesHandler,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
} from "../controllers/address.controller";

export const addressRouter = Router();

addressRouter.use(requireAuth);

addressRouter.get("/", listAddressesHandler);
addressRouter.post("/", validate({ body: addressBodySchema }), createAddressHandler);
addressRouter.put("/:id", validate({ params: addressIdParamSchema, body: updateAddressSchema }), updateAddressHandler);
addressRouter.delete("/:id", validate({ params: addressIdParamSchema }), deleteAddressHandler);
