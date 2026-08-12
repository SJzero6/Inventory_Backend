import { Router } from "express";
import { healthCheck } from "../controllers/healthcontroller";

const router = Router();

router.get("/", healthCheck);

export default router;