import { Router } from "express";

import {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deactivateBrand
} from "../controllers/brandController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";

const router = Router();

router.get(
    "/",
    authenticate,
    authorize("BRAND_VIEW"),
    getBrands
);

router.get(
    "/:id",
    authenticate,
    authorize("BRAND_VIEW"),
    getBrandById
);

router.post(
    "/",
    authenticate,
    authorize("BRAND_CREATE"),
    createBrand
);

router.put(
    "/:id",
    authenticate,
    authorize("BRAND_EDIT"),
    updateBrand
);

router.delete(
    "/:id",
    authenticate,
    authorize("BRAND_DELETE"),
    deactivateBrand
);

export default router;