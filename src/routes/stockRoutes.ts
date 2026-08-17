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


// =========================
// STOCK
// =========================

router.get(
    "/",
    authenticate,
    authorize("STOCK_VIEW"),
    getStock
);


// =========================
// STOCK TRANSACTIONS
// =========================

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


// =========================
// STOCK OPERATIONS
// =========================

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


// =========================
// STOCK BY ID
// IMPORTANT: Keep this LAST
// =========================

router.get(
    "/:id",
    authenticate,
    authorize("STOCK_VIEW"),
    getStockById
);


export default router;