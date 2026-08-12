import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getCategories(
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
                    Description,
                    IsActive,
                    CreatedAt
                FROM Categories
                WHERE CompanyId = @companyId
                ORDER BY Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error("Get categories error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve categories"
        });
    }
}


export async function getCategoryById(
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

        const categoryId = Number(req.params.id);

        if (!Number.isInteger(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId)
            .query(`
                SELECT
                    Id,
                    CompanyId,
                    Name,
                    Description,
                    IsActive,
                    CreatedAt
                FROM Categories
                WHERE
                    Id = @categoryId
                    AND CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {

        console.error("Get category error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve category"
        });
    }
}


export async function createCategory(
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
            description
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const db = getDatabase();

        // Check duplicate category name
        const existing = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Categories
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
            `);

        if (existing.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Category already exists"
            });
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .input("description", description ?? null)
            .query(`
                INSERT INTO Categories
                (
                    CompanyId,
                    Name,
                    Description,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @name,
                    @description,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            categoryId: result.recordset[0].Id
        });

    } catch (error) {

        console.error("Create category error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create category"
        });
    }
}


export async function updateCategory(
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

        const categoryId = Number(req.params.id);

        if (!Number.isInteger(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const {
            name,
            description,
            isActive
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const db = getDatabase();

        // Check category exists
        const category = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId)
            .query(`
                SELECT Id
                FROM Categories
                WHERE
                    Id = @categoryId
                    AND CompanyId = @companyId
            `);

        if (category.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Check duplicate name
        const duplicate = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Categories
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
                    AND Id <> @categoryId
            `);

        if (duplicate.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Category name already exists"
            });
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId)
            .input("name", name.trim())
            .input("description", description ?? null)
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Categories
                SET
                    Name = @name,
                    Description = @description,
                    IsActive = @isActive
                WHERE
                    Id = @categoryId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Category updated successfully"
        });

    } catch (error) {

        console.error("Update category error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update category"
        });
    }
}


export async function deactivateCategory(
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

        const categoryId = Number(req.params.id);

        if (!Number.isInteger(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId)
            .query(`
                UPDATE Categories
                SET IsActive = 0
                WHERE
                    Id = @categoryId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Category deactivated successfully"
        });

    } catch (error) {

        console.error("Deactivate category error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate category"
        });
    }
}