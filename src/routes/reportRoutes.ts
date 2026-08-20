import { Router } from "express";

import {
    getStockReport,
    getPurchaseReport,
    getTransactionReport
} from "../controllers/reportController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";


const router = Router();


// =====================================================
// STOCK REPORT
// =====================================================

router.get(
    "/stock",
    authenticate,
    authorize("REPORT_STOCK"),
    getStockReport
);


router.get(
    "/purchases",
    authenticate,
    authorize("REPORT_PURCHASE"),
    getPurchaseReport
);


router.get(
    "/transactions",
    authenticate,
    authorize("REPORT_TRANSACTION"),
    getTransactionReport
);

export default router;