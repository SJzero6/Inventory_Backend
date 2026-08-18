import { Router } from "express";

import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    approvePurchaseOrder
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


export default router;