import { Router } from "express";

import {
    getWarehouses,
    getWarehouseById,
    createWarehouse,
    updateWarehouse,
    deactivateWarehouse
} from "../controllers/warehouseController";

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
    authorize("WAREHOUSE_VIEW"),
    getWarehouses
);

router.get(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_VIEW"),
    getWarehouseById
);

router.post(
    "/",
    authenticate,
    authorize("WAREHOUSE_CREATE"),
    createWarehouse
);

router.put(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_EDIT"),
    updateWarehouse
);

router.delete(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_DELETE"),
    deactivateWarehouse
);

export default router;