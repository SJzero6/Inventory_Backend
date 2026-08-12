import { Router } from "express";

import {
    getUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deactivateUnit
} from "../controllers/unitController";

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
    authorize("UNIT_VIEW"),
    getUnits
);

router.get(
    "/:id",
    authenticate,
    authorize("UNIT_VIEW"),
    getUnitById
);

router.post(
    "/",
    authenticate,
    authorize("UNIT_CREATE"),
    createUnit
);

router.put(
    "/:id",
    authenticate,
    authorize("UNIT_EDIT"),
    updateUnit
);

router.delete(
    "/:id",
    authenticate,
    authorize("UNIT_DELETE"),
    deactivateUnit
);

export default router;