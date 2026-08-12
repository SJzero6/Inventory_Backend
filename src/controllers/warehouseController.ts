import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getWarehouses(
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
                    w.Id,
                    w.CompanyId,
                    w.BranchId,
                    b.Name AS BranchName,
                    w.Name,
                    w.Code,
                    w.Address,
                    w.IsActive,
                    w.CreatedAt,
                    w.UpdatedAt
                FROM Warehouses w
                INNER JOIN Branches b
                    ON b.Id = w.BranchId
                WHERE
                    w.CompanyId = @companyId
                ORDER BY w.Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error("Get warehouses error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve warehouses"
        });
    }
}


export async function getWarehouseById(
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

        const warehouseId = Number(req.params.id);

        if (!Number.isInteger(warehouseId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid warehouse ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", warehouseId)
            .query(`
                SELECT
                    w.Id,
                    w.CompanyId,
                    w.BranchId,
                    b.Name AS BranchName,
                    w.Name,
                    w.Code,
                    w.Address,
                    w.IsActive,
                    w.CreatedAt,
                    w.UpdatedAt
                FROM Warehouses w
                INNER JOIN Branches b
                    ON b.Id = w.BranchId
                WHERE
                    w.Id = @warehouseId
                    AND w.CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Warehouse not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error("Get warehouse error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve warehouse"
        });
    }
}


export async function createWarehouse(
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
            branchId,
            name,
            code,
            address
        } = req.body;

        if (!branchId) {
            return res.status(400).json({
                success: false,
                message: "Branch is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Warehouse name is required"
            });
        }

        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Warehouse code is required"
            });
        }

        const db = getDatabase();

        // Validate branch belongs to current company
        const branch = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("branchId", Number(branchId))
            .query(`
                SELECT Id
                FROM Branches
                WHERE
                    Id = @branchId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (branch.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or inactive branch"
            });
        }

        // Check duplicate warehouse code
        const existingCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("code", code.trim())
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    CompanyId = @companyId
                    AND Code = @code
            `);

        if (existingCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Warehouse code already exists"
            });
        }

        // Check duplicate warehouse name within branch
        const existingName = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("branchId", Number(branchId))
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    CompanyId = @companyId
                    AND BranchId = @branchId
                    AND Name = @name
            `);

        if (existingName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Warehouse name already exists in this branch"
            });
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("branchId", Number(branchId))
            .input("name", name.trim())
            .input("code", code.trim())
            .input("address", address?.trim() || null)
            .query(`
                INSERT INTO Warehouses
                (
                    CompanyId,
                    BranchId,
                    Name,
                    Code,
                    Address,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @branchId,
                    @name,
                    @code,
                    @address,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Warehouse created successfully",
            warehouseId: result.recordset[0].Id
        });

    } catch (error) {
        console.error("Create warehouse error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create warehouse"
        });
    }
}


export async function updateWarehouse(
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

        const warehouseId = Number(req.params.id);

        if (!Number.isInteger(warehouseId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid warehouse ID"
            });
        }

        const {
            branchId,
            name,
            code,
            address,
            isActive
        } = req.body;

        if (!branchId) {
            return res.status(400).json({
                success: false,
                message: "Branch is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Warehouse name is required"
            });
        }

        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Warehouse code is required"
            });
        }

        const db = getDatabase();

        // Check warehouse belongs to company
        const existingWarehouse = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", warehouseId)
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    Id = @warehouseId
                    AND CompanyId = @companyId
            `);

        if (existingWarehouse.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Warehouse not found"
            });
        }

        // Validate branch belongs to company
        const branch = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("branchId", Number(branchId))
            .query(`
                SELECT Id
                FROM Branches
                WHERE
                    Id = @branchId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (branch.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or inactive branch"
            });
        }

        // Check duplicate code
        const duplicateCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", warehouseId)
            .input("code", code.trim())
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    CompanyId = @companyId
                    AND Code = @code
                    AND Id <> @warehouseId
            `);

        if (duplicateCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Warehouse code already exists"
            });
        }

        // Check duplicate name in branch
        const duplicateName = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("branchId", Number(branchId))
            .input("warehouseId", warehouseId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    CompanyId = @companyId
                    AND BranchId = @branchId
                    AND Name = @name
                    AND Id <> @warehouseId
            `);

        if (duplicateName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Warehouse name already exists in this branch"
            });
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", warehouseId)
            .input("branchId", Number(branchId))
            .input("name", name.trim())
            .input("code", code.trim())
            .input("address", address?.trim() || null)
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Warehouses
                SET
                    BranchId = @branchId,
                    Name = @name,
                    Code = @code,
                    Address = @address,
                    IsActive = @isActive,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @warehouseId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Warehouse updated successfully"
        });

    } catch (error) {
        console.error("Update warehouse error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update warehouse"
        });
    }
}


export async function deactivateWarehouse(
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

        const warehouseId = Number(req.params.id);

        if (!Number.isInteger(warehouseId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid warehouse ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", warehouseId)
            .query(`
                UPDATE Warehouses
                SET
                    IsActive = 0,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @warehouseId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Warehouse not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Warehouse deactivated successfully"
        });

    } catch (error) {
        console.error("Deactivate warehouse error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate warehouse"
        });
    }
}