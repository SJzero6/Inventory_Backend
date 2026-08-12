import { Router } from "express";

import {
    getWarehouseLocations,
    getWarehouseLocationById,
    createWarehouseLocation,
    updateWarehouseLocation,
    deactivateWarehouseLocation
} from "../controllers/warehouseLocationController";

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
    authorize("WAREHOUSE_LOCATION_VIEW"),
    getWarehouseLocations
);

router.get(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_LOCATION_VIEW"),
    getWarehouseLocationById
);

router.post(
    "/",
    authenticate,
    authorize("WAREHOUSE_LOCATION_CREATE"),
    createWarehouseLocation
);

router.put(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_LOCATION_EDIT"),
    updateWarehouseLocation
);

router.delete(
    "/:id",
    authenticate,
    authorize("WAREHOUSE_LOCATION_DELETE"),
    deactivateWarehouseLocation
);

export default router;