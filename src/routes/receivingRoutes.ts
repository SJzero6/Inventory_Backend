import { Router } from "express";

import {
    createGoodsReceipt,
    getGoodsReceipts,
    getGoodsReceiptById,
    approveGoodsReceipt,
    cancelGoodsReceipt
} from "../controllers/receivingController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";


const router = Router();


// =====================================================
// GET ALL GOODS RECEIPTS
// =====================================================

router.get(
    "/",
    authenticate,
    authorize("RECEIVING_VIEW"),
    getGoodsReceipts
);


// =====================================================
// CREATE GOODS RECEIPT
// =====================================================

router.post(
    "/",
    authenticate,
    authorize("RECEIVING_CREATE"),
    createGoodsReceipt
);

// =====================================================
// APPROVE
// =====================================================

router.post(
    "/:id/approve",
    authenticate,
    authorize("RECEIVING_APPROVE"),
    approveGoodsReceipt
);

// =================================================
// CANCEL RECEIPT
// =================================================

router.post(
    "/:id/cancel",
    authenticate,
    authorize("RECEIVING_APPROVE"),
    cancelGoodsReceipt
);

// =====================================================
// GET GOODS RECEIPT BY ID
// =====================================================

router.get(
    "/:id",
    authenticate,
    authorize("RECEIVING_VIEW"),
    getGoodsReceiptById
);


export default router;