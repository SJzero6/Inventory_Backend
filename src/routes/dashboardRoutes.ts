import { Router } from "express";

import {
    dashboard
} from "../controllers/dashboardController";

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
    authorize("DASHBOARD_VIEW"),
    dashboard
);

export default router;