import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getBrands(
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
                    IsActive,
                    CreatedAt
                FROM Brands
                WHERE CompanyId = @companyId
                ORDER BY Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error("Get brands error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve brands"
        });
    }
}


export async function getBrandById(
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

        const brandId = Number(req.params.id);

        if (!Number.isInteger(brandId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("brandId", brandId)
            .query(`
                SELECT
                    Id,
                    CompanyId,
                    Name,
                    IsActive,
                    CreatedAt
                FROM Brands
                WHERE
                    Id = @brandId
                    AND CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Brand not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {

        console.error("Get brand error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve brand"
        });
    }
}


export async function createBrand(
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
            name
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name is required"
            });
        }

        const db = getDatabase();

        // Check duplicate brand
        const existing = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Brands
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
            `);

        if (existing.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Brand already exists"
            });
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .query(`
                INSERT INTO Brands
                (
                    CompanyId,
                    Name,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @name,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Brand created successfully",
            brandId: result.recordset[0].Id
        });

    } catch (error) {

        console.error("Create brand error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create brand"
        });
    }
}


export async function updateBrand(
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

        const brandId = Number(req.params.id);

        if (!Number.isInteger(brandId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID"
            });
        }

        const {
            name,
            isActive
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Brand name is required"
            });
        }

        const db = getDatabase();

        // Check brand exists
        const brand = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("brandId", brandId)
            .query(`
                SELECT Id
                FROM Brands
                WHERE
                    Id = @brandId
                    AND CompanyId = @companyId
            `);

        if (brand.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Brand not found"
            });
        }

        // Check duplicate name
        const duplicate = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("brandId", brandId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Brands
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
                    AND Id <> @brandId
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Brand name already exists"
            });
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("brandId", brandId)
            .input("name", name.trim())
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Brands
                SET
                    Name = @name,
                    IsActive = @isActive
                WHERE
                    Id = @brandId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Brand updated successfully"
        });

    } catch (error) {

        console.error("Update brand error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update brand"
        });
    }
}


export async function deactivateBrand(
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

        const brandId = Number(req.params.id);

        if (!Number.isInteger(brandId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("brandId", brandId)
            .query(`
                UPDATE Brands
                SET IsActive = 0
                WHERE
                    Id = @brandId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Brand not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Brand deactivated successfully"
        });

    } catch (error) {

        console.error("Deactivate brand error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate brand"
        });
    }
}