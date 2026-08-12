import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getUnits(
    req: AuthRequest,
    res: Response
) {
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
            .input("companyId", req.user.companyId)
            .query(`
                SELECT
                    Id,
                    CompanyId,
                    Name,
                    ShortName,
                    IsActive,
                    CreatedAt
                FROM Units
                WHERE CompanyId = @companyId
                ORDER BY Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error("Get units error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve units"
        });
    }
}


export async function getUnitById(
    req: AuthRequest,
    res: Response
) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const unitId = Number(req.params.id);

        if (!Number.isInteger(unitId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid unit ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("unitId", unitId)
            .query(`
                SELECT
                    Id,
                    CompanyId,
                    Name,
                    ShortName,
                    IsActive,
                    CreatedAt
                FROM Units
                WHERE
                    Id = @unitId
                    AND CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error("Get unit error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve unit"
        });
    }
}


export async function createUnit(
    req: AuthRequest,
    res: Response
) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const {
            name,
            shortName
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Unit name is required"
            });
        }

        const db = getDatabase();

        // Check duplicate unit name
        const existing = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Units
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
            `);

        if (existing.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Unit already exists"
            });
        }

        // Check duplicate short name
        if (shortName && shortName.trim()) {

            const existingShortName = await db
                .request()
                .input("companyId", req.user.companyId)
                .input("shortName", shortName.trim())
                .query(`
                    SELECT Id
                    FROM Units
                    WHERE
                        CompanyId = @companyId
                        AND ShortName = @shortName
                `);

            if (existingShortName.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Unit short name already exists"
                });
            }
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .input(
                "shortName",
                shortName && shortName.trim()
                    ? shortName.trim()
                    : null
            )
            .query(`
                INSERT INTO Units
                (
                    CompanyId,
                    Name,
                    ShortName,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @name,
                    @shortName,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Unit created successfully",
            unitId: result.recordset[0].Id
        });

    } catch (error) {
        console.error("Create unit error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create unit"
        });
    }
}


export async function updateUnit(
    req: AuthRequest,
    res: Response
) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const unitId = Number(req.params.id);

        if (!Number.isInteger(unitId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid unit ID"
            });
        }

        const {
            name,
            shortName,
            isActive
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Unit name is required"
            });
        }

        const db = getDatabase();

        // Check unit exists
        const unit = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("unitId", unitId)
            .query(`
                SELECT Id
                FROM Units
                WHERE
                    Id = @unitId
                    AND CompanyId = @companyId
            `);

        if (unit.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Unit not found"
            });
        }

        // Check duplicate name
        const duplicateName = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("unitId", unitId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Units
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
                    AND Id <> @unitId
            `);

        if (duplicateName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Unit name already exists"
            });
        }

        // Check duplicate short name
        if (shortName && shortName.trim()) {

            const duplicateShortName = await db
                .request()
                .input("companyId", req.user.companyId)
                .input("unitId", unitId)
                .input("shortName", shortName.trim())
                .query(`
                    SELECT Id
                    FROM Units
                    WHERE
                        CompanyId = @companyId
                        AND ShortName = @shortName
                        AND Id <> @unitId
                `);

            if (duplicateShortName.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Unit short name already exists"
                });
            }
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("unitId", unitId)
            .input("name", name.trim())
            .input(
                "shortName",
                shortName && shortName.trim()
                    ? shortName.trim()
                    : null
            )
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Units
                SET
                    Name = @name,
                    ShortName = @shortName,
                    IsActive = @isActive
                WHERE
                    Id = @unitId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Unit updated successfully"
        });

    } catch (error) {
        console.error("Update unit error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update unit"
        });
    }
}


export async function deactivateUnit(
    req: AuthRequest,
    res: Response
) {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const unitId = Number(req.params.id);

        if (!Number.isInteger(unitId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid unit ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("unitId", unitId)
            .query(`
                UPDATE Units
                SET IsActive = 0
                WHERE
                    Id = @unitId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Unit not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Unit deactivated successfully"
        });

    } catch (error) {
        console.error("Deactivate unit error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate unit"
        });
    }
}