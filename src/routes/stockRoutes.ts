import { Router } from "express";

import {
    getStock,
    getStockById,
    adjustStock
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

router.post(
    "/adjust",
    authenticate,
    authorize("STOCK_ADJUST"),
    adjustStock
);

export default router;