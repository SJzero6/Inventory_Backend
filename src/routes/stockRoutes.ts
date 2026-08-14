import { Router } from "express";

import {
    getStock,
    getStockById
} from "../controllers/stockController";

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
    authorize("STOCK_VIEW"),
    getStock
);

router.get(
    "/:id",
    authenticate,
    authorize("STOCK_VIEW"),
    getStockById
);

export default router;