import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getWarehouseLocations(
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

        const request = db.request()
            .input("companyId", req.user.companyId);

        let query = `
            SELECT
                wl.Id,
                wl.WarehouseId,
                w.Name AS WarehouseName,
                w.Code AS WarehouseCode,
                wl.Name,
                wl.Code,
                wl.Description,
                wl.IsActive,
                wl.CreatedAt
            FROM WarehouseLocations wl
            INNER JOIN Warehouses w
                ON w.Id = wl.WarehouseId
            WHERE
                w.CompanyId = @companyId
        `;

        if (req.query.warehouseId) {
            const warehouseId = Number(req.query.warehouseId);

            if (!Number.isInteger(warehouseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid warehouse ID"
                });
            }

            request.input("warehouseId", warehouseId);

            query += `
                AND wl.WarehouseId = @warehouseId
            `;
        }

        query += `
            ORDER BY w.Name, wl.Name
        `;

        const result = await request.query(query);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error("Get warehouse locations error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve warehouse locations"
        });
    }
}


export async function getWarehouseLocationById(
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

        const locationId = Number(req.params.id);

        if (!Number.isInteger(locationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid location ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("locationId", locationId)
            .query(`
                SELECT
                    wl.Id,
                    wl.WarehouseId,
                    w.Name AS WarehouseName,
                    w.Code AS WarehouseCode,
                    wl.Name,
                    wl.Code,
                    wl.Description,
                    wl.IsActive,
                    wl.CreatedAt
                FROM WarehouseLocations wl
                INNER JOIN Warehouses w
                    ON w.Id = wl.WarehouseId
                WHERE
                    wl.Id = @locationId
                    AND w.CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Warehouse location not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error("Get warehouse location error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve warehouse location"
        });
    }
}


export async function createWarehouseLocation(
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
            warehouseId,
            name,
            code,
            description
        } = req.body;

        if (!warehouseId) {
            return res.status(400).json({
                success: false,
                message: "Warehouse is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location name is required"
            });
        }

        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location code is required"
            });
        }

        const db = getDatabase();

        // Validate warehouse belongs to current company
        const warehouse = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", Number(warehouseId))
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    Id = @warehouseId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (warehouse.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or inactive warehouse"
            });
        }

        // Check duplicate location code within warehouse
        const existingCode = await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("code", code.trim())
            .query(`
                SELECT Id
                FROM WarehouseLocations
                WHERE
                    WarehouseId = @warehouseId
                    AND Code = @code
            `);

        if (existingCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Location code already exists in this warehouse"
            });
        }

        // Check duplicate location name within warehouse
        const existingName = await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM WarehouseLocations
                WHERE
                    WarehouseId = @warehouseId
                    AND Name = @name
            `);

        if (existingName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Location name already exists in this warehouse"
            });
        }

        const result = await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("name", name.trim())
            .input("code", code.trim())
            .input("description", description?.trim() || null)
            .query(`
                INSERT INTO WarehouseLocations
                (
                    WarehouseId,
                    Name,
                    Code,
                    Description,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @warehouseId,
                    @name,
                    @code,
                    @description,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Warehouse location created successfully",
            locationId: result.recordset[0].Id
        });

    } catch (error) {
        console.error("Create warehouse location error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create warehouse location"
        });
    }
}


export async function updateWarehouseLocation(
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

        const locationId = Number(req.params.id);

        if (!Number.isInteger(locationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid location ID"
            });
        }

        const {
            warehouseId,
            name,
            code,
            description,
            isActive
        } = req.body;

        if (!warehouseId) {
            return res.status(400).json({
                success: false,
                message: "Warehouse is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location name is required"
            });
        }

        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: "Location code is required"
            });
        }

        const db = getDatabase();

        // Check location belongs to current company
        const existingLocation = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("locationId", locationId)
            .query(`
                SELECT
                    wl.Id
                FROM WarehouseLocations wl
                INNER JOIN Warehouses w
                    ON w.Id = wl.WarehouseId
                WHERE
                    wl.Id = @locationId
                    AND w.CompanyId = @companyId
            `);

        if (existingLocation.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Warehouse location not found"
            });
        }

        // Validate new warehouse
        const warehouse = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("warehouseId", Number(warehouseId))
            .query(`
                SELECT Id
                FROM Warehouses
                WHERE
                    Id = @warehouseId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (warehouse.recordset.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or inactive warehouse"
            });
        }

        // Check duplicate code
        const duplicateCode = await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("locationId", locationId)
            .input("code", code.trim())
            .query(`
                SELECT Id
                FROM WarehouseLocations
                WHERE
                    WarehouseId = @warehouseId
                    AND Code = @code
                    AND Id <> @locationId
            `);

        if (duplicateCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Location code already exists in this warehouse"
            });
        }

        // Check duplicate name
        const duplicateName = await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("locationId", locationId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM WarehouseLocations
                WHERE
                    WarehouseId = @warehouseId
                    AND Name = @name
                    AND Id <> @locationId
            `);

        if (duplicateName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Location name already exists in this warehouse"
            });
        }

        await db
            .request()
            .input("warehouseId", Number(warehouseId))
            .input("locationId", locationId)
            .input("name", name.trim())
            .input("code", code.trim())
            .input("description", description?.trim() || null)
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE WarehouseLocations
                SET
                    WarehouseId = @warehouseId,
                    Name = @name,
                    Code = @code,
                    Description = @description,
                    IsActive = @isActive
                WHERE
                    Id = @locationId
            `);

        return res.json({
            success: true,
            message: "Warehouse location updated successfully"
        });

    } catch (error) {
        console.error("Update warehouse location error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update warehouse location"
        });
    }
}


export async function deactivateWarehouseLocation(
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

        const locationId = Number(req.params.id);

        if (!Number.isInteger(locationId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid location ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("locationId", locationId)
            .query(`
                UPDATE wl
                SET
                    IsActive = 0
                FROM WarehouseLocations wl
                INNER JOIN Warehouses w
                    ON w.Id = wl.WarehouseId
                WHERE
                    wl.Id = @locationId
                    AND w.CompanyId = @companyId
                    AND wl.IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Location not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Warehouse location deactivated successfully"
        });

    } catch (error) {
        console.error("Deactivate warehouse location error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate warehouse location"
        });
    }
}