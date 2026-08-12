import { Router } from "express";

import {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deactivateProduct
} from "../controllers/productController";

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
    authorize("PRODUCT_VIEW"),
    getProducts
);

router.get(
    "/:id",
    authenticate,
    authorize("PRODUCT_VIEW"),
    getProductById
);

router.post(
    "/",
    authenticate,
    authorize("PRODUCT_CREATE"),
    createProduct
);

router.put(
    "/:id",
    authenticate,
    authorize("PRODUCT_EDIT"),
    updateProduct
);

router.delete(
    "/:id",
    authenticate,
    authorize("PRODUCT_DELETE"),
    deactivateProduct
);

export default router;