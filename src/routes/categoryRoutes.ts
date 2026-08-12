import { Router } from "express";

import {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deactivateCategory
} from "../controllers/categoryController";

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
    authorize("CATEGORY_VIEW"),
    getCategories
);

router.get(
    "/:id",
    authenticate,
    authorize("CATEGORY_VIEW"),
    getCategoryById
);

router.post(
    "/",
    authenticate,
    authorize("CATEGORY_CREATE"),
    createCategory
);

router.put(
    "/:id",
    authenticate,
    authorize("CATEGORY_EDIT"),
    updateCategory
);

router.delete(
    "/:id",
    authenticate,
    authorize("CATEGORY_DELETE"),
    deactivateCategory
);

export default router;