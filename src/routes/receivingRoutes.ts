import { Router } from "express";

import {
    createGoodsReceipt
} from "../controllers/receivingController";

import {
    authenticate
} from "../middleware/authMiddleware";

import {
    authorize
} from "../middleware/permissionMiddleware";


const router = Router();


router.post(
    "/",
    authenticate,
    authorize("RECEIVING_CREATE"),
    createGoodsReceipt
);


export default router;