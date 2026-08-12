import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "development-secret";

export interface JwtPayload {
    userId: number;
    companyId: number;
    branchId: number | null;
}

export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: "8h"
    });
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
}