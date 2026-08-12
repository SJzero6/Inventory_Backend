import { Router } from "express";

import {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deactivateSupplier
} from "../controllers/supplierController";

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
    authorize("SUPPLIER_VIEW"),
    getSuppliers
);

router.get(
    "/:id",
    authenticate,
    authorize("SUPPLIER_VIEW"),
    getSupplierById
);

router.post(
    "/",
    authenticate,
    authorize("SUPPLIER_CREATE"),
    createSupplier
);

router.put(
    "/:id",
    authenticate,
    authorize("SUPPLIER_EDIT"),
    updateSupplier
);

router.delete(
    "/:id",
    authenticate,
    authorize("SUPPLIER_DELETE"),
    deactivateSupplier
);

export default router;