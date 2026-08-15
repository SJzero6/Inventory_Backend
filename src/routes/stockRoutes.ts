import { Router } from "express";

import {
    getStock,
    getStockById,
    adjustStock,
    transferStock,
    getStockTransactions,
    getStockTransactionById
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

router.post(
    "/transfer",
    authenticate,
    authorize("STOCK_TRANSFER"),
    transferStock
);

router.get(
    "/transactions",
    authenticate,
    authorize("REPORT_TRANSACTION"),
    getStockTransactions
);

router.get(
    "/transactions/:id",
    authenticate,
    authorize("REPORT_TRANSACTION"),
    getStockTransactionById
);

export default router;