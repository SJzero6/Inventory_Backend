import { Router } from "express";

import {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderById
} from "../controllers/purchaseController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";


const router = Router();


// =====================================================
// PURCHASE ORDERS
// =====================================================

// POST /api/purchases
router.post(
    "/",
    authenticate,
    authorize("PURCHASE_CREATE"),
    createPurchaseOrder
);


// GET /api/purchases
router.get(
    "/",
    authenticate,
    authorize("PURCHASE_VIEW"),
    getPurchaseOrders
);


// GET /api/purchases/:id
router.get(
    "/:id",
    authenticate,
    authorize("PURCHASE_VIEW"),
    getPurchaseOrderById
);


export default router;