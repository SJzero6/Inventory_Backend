import { Response, NextFunction } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "./authMiddleware";

export function authorize(permissionCode: string) {

    return async (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ) => {

        try {

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required"
                });
            }

            const db = getDatabase();

            const result = await db
                .request()
                .input("userId", req.user.userId)
                .input("permissionCode", permissionCode)
                .query(`
                    SELECT TOP 1
                        p.Id
                    FROM UserRoles ur

                    INNER JOIN RolePermissions rp
                        ON rp.RoleId = ur.RoleId

                    INNER JOIN Permissions p
                        ON p.Id = rp.PermissionId

                    INNER JOIN Roles r
                        ON r.Id = ur.RoleId

                    WHERE
                        ur.UserId = @userId
                        AND p.Code = @permissionCode
                        AND p.IsActive = 1
                        AND r.IsActive = 1
                `);

            if (result.recordset.length === 0) {

                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action"
                });

            }

            next();

        } catch (error) {

            console.error("Permission check error:", error);

            return res.status(500).json({
                success: false,
                message: "Permission check failed"
            });
        }
    };
}