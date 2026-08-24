import { Router } from "express";

import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    approvePurchaseOrder,
    getPurchaseOrderReceivingStatus,
    cancelPurchaseOrder,
    getPurchaseReport
} from "../controllers/purchaseController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";


const router = Router();


// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

router.post(
    "/",
    authenticate,
    authorize("PURCHASE_CREATE"),
    createPurchaseOrder
);


// =====================================================
// GET PURCHASE ORDERS
// =====================================================

router.get(
    "/",
    authenticate,
    authorize("PURCHASE_VIEW"),
    getPurchaseOrders
);


router.get(
    "/:id/receiving-status",
    authenticate,
    authorize("PURCHASE_VIEW"),
    getPurchaseOrderReceivingStatus
);

// =====================================================
// UPDATE PURCHASE ORDER
// =====================================================

router.put(
    "/:id",
    authenticate,
    authorize("PURCHASE_EDIT"),
    updatePurchaseOrder
);

// =====================================================
// Delete PURCHASE ORDER
// =====================================================

router.post(
    "/:id/cancel",
    authenticate,
    authorize("PURCHASE_EDIT"),
    cancelPurchaseOrder
);

// =====================================================
// APPROVE PURCHASE ORDER
// =====================================================

router.post(
    "/:id/approve",
    authenticate,
    authorize("PURCHASE_APPROVE"),
    approvePurchaseOrder
);


// =====================================================
// GET PURCHASE ORDER BY ID
// IMPORTANT: KEEP THIS AFTER SPECIFIC ROUTES
// =====================================================

router.get(
    "/:id",
    authenticate,
    authorize("PURCHASE_VIEW"),
    getPurchaseOrderById
);

router.get(
    "/purchases",
    authenticate,
    authorize("REPORT_PURCHASE"),
    getPurchaseReport
);


export default router;