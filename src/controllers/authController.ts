import { Request, Response } from "express";
import { getDatabase } from "../config/database";
import { comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";

export async function login(req: Request, res: Response) {

    try {

        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        const db = getDatabase();

        const userResult = await db
            .request()
            .input("username", username)
            .query(`
                SELECT
                    u.Id,
                    u.CompanyId,
                    u.BranchId,
                    u.Username,
                    u.PasswordHash,
                    u.FullName,
                    u.Email,
                    u.IsActive,

                    c.Name AS CompanyName,

                    b.Name AS BranchName

                FROM Users u

                INNER JOIN Companies c
                    ON c.Id = u.CompanyId

                LEFT JOIN Branches b
                    ON b.Id = u.BranchId

                WHERE
                    u.Username = @username
                    AND u.IsActive = 1
            `);

        if (userResult.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        const user = userResult.recordset[0];

        const passwordValid = await comparePassword(
            password,
            user.PasswordHash
        );

        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });
        }

        /*
         * Get user's roles
         */
        const rolesResult = await db
            .request()
            .input("userId", user.Id)
            .query(`
                SELECT
                    r.Id,
                    r.Name
                FROM UserRoles ur

                INNER JOIN Roles r
                    ON r.Id = ur.RoleId

                WHERE
                    ur.UserId = @userId
                    AND r.IsActive = 1
            `);

        /*
         * Get user's permissions
         */
        const permissionsResult = await db
            .request()
            .input("userId", user.Id)
            .query(`
                SELECT DISTINCT
                    p.Id,
                    p.Code,
                    p.Name,
                    p.Module
                FROM UserRoles ur

                INNER JOIN RolePermissions rp
                    ON rp.RoleId = ur.RoleId

                INNER JOIN Permissions p
                    ON p.Id = rp.PermissionId

                INNER JOIN Roles r
                    ON r.Id = ur.RoleId

                WHERE
                    ur.UserId = @userId
                    AND r.IsActive = 1
                    AND p.IsActive = 1
            `);

        /*
         * Generate JWT
         */
        const token = generateToken({
            userId: user.Id,
            companyId: user.CompanyId,
            branchId: user.BranchId
        });

        /*
         * Update last login
         */
        await db
            .request()
            .input("userId", user.Id)
            .query(`
                UPDATE Users
                SET LastLoginAt = GETDATE()
                WHERE Id = @userId
            `);

        return res.json({
            success: true,

            message: "Login successful",

            token,

            user: {
                id: user.Id,
                username: user.Username,
                fullName: user.FullName,
                email: user.Email
            },

            company: {
                id: user.CompanyId,
                name: user.CompanyName
            },

            branch: user.BranchId
                ? {
                    id: user.BranchId,
                    name: user.BranchName
                }
                : null,

            roles: rolesResult.recordset,

            permissions: permissionsResult.recordset
        });

    } catch (error) {

        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}