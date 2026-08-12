import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        companyId: number;
        branchId: number | null;
    };
}

export function authenticate(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    try {

        const authorization = req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if (!authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });
        }

        const token = authorization.substring(7);

        const payload = verifyToken(token);

        req.user = payload;

        next();

    } catch (error) {

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}