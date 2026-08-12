import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";

export async function dashboard(
    req: AuthRequest,
    res: Response
) {
    return res.json({
        success: true,
        message: "Dashboard access granted",

        user: req.user
    });
}