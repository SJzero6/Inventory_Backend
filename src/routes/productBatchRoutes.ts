import { Router } from "express";

import {
    getProductBatches,
    getProductBatchById,
    createProductBatch,
    updateProductBatch,
    updateProductBatchStatus,
    getProductBatchExpiry
} from "../controllers/productBatchController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";

const router = Router();


// =====================================================
// GET ALL PRODUCT BATCHES
// =====================================================

router.get(
    "/",
    authenticate,
    authorize("STOCK_VIEW"),
    getProductBatches
);


router.get(
    "/expiry",
    authenticate,
    authorize("STOCK_VIEW"),
    getProductBatchExpiry
);


// =====================================================
// GET PRODUCT BATCH BY ID
// =====================================================

router.get(
    "/:id",
    authenticate,
    authorize("STOCK_VIEW"),
    getProductBatchById
);


// =====================================================
// CREATE PRODUCT BATCH
// =====================================================

router.post(
    "/",
    authenticate,
    authorize("STOCK_ADJUST"),
    createProductBatch
);

router.put(
    "/:id",
    authenticate,
    authorize("STOCK_ADJUST"),
    updateProductBatch
);

router.patch(
    "/:id/status",
    authenticate,
    authorize("STOCK_ADJUST"),
    updateProductBatchStatus
);

export default router;