import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getStock(
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
                s.Id,
                s.CompanyId,

                s.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                s.WarehouseId,
                w.Name AS WarehouseName,
                w.Code AS WarehouseCode,

                s.LocationId,
                wl.Name AS LocationName,
                wl.Code AS LocationCode,

                s.BatchId,
                pb.BatchNumber,
                pb.ManufactureDate,
                pb.ExpiryDate,

                s.Quantity,
                s.AverageCost,
                s.UpdatedAt

            FROM Stock s

            INNER JOIN Products p
                ON p.Id = s.ProductId

            INNER JOIN Warehouses w
                ON w.Id = s.WarehouseId

            LEFT JOIN WarehouseLocations wl
                ON wl.Id = s.LocationId

            LEFT JOIN ProductBatches pb
                ON pb.Id = s.BatchId

            WHERE
                s.CompanyId = @companyId
        `;

        // Product filter
        if (req.query.productId) {
            const productId = Number(req.query.productId);

            if (!Number.isInteger(productId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID"
                });
            }

            request.input("productId", productId);

            query += `
                AND s.ProductId = @productId
            `;
        }

        // Warehouse filter
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
                AND s.WarehouseId = @warehouseId
            `;
        }

        // Location filter
        if (req.query.locationId) {
            const locationId = Number(req.query.locationId);

            if (!Number.isInteger(locationId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid location ID"
                });
            }

            request.input("locationId", locationId);

            query += `
                AND s.LocationId = @locationId
            `;
        }

        // Batch filter
        if (req.query.batchId) {
            const batchId = Number(req.query.batchId);

            if (!Number.isInteger(batchId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid batch ID"
                });
            }

            request.input("batchId", batchId);

            query += `
                AND s.BatchId = @batchId
            `;
        }

        query += `
            ORDER BY
                p.Name,
                w.Name,
                wl.Name,
                pb.BatchNumber
        `;

        const result = await request.query(query);

        return res.json({
            success: true,
            count: result.recordset.length,
            data: result.recordset
        });

    } catch (error) {
        console.error("Get stock error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve stock"
        });
    }
}


export async function getStockById(
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

        const stockId = Number(req.params.id);

        if (!Number.isInteger(stockId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid stock ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("stockId", stockId)
            .query(`
                SELECT
                    s.Id,
                    s.CompanyId,

                    s.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,

                    s.WarehouseId,
                    w.Name AS WarehouseName,
                    w.Code AS WarehouseCode,

                    s.LocationId,
                    wl.Name AS LocationName,
                    wl.Code AS LocationCode,

                    s.BatchId,
                    pb.BatchNumber,
                    pb.ManufactureDate,
                    pb.ExpiryDate,

                    s.Quantity,
                    s.AverageCost,
                    s.UpdatedAt

                FROM Stock s

                INNER JOIN Products p
                    ON p.Id = s.ProductId

                INNER JOIN Warehouses w
                    ON w.Id = s.WarehouseId

                LEFT JOIN WarehouseLocations wl
                    ON wl.Id = s.LocationId

                LEFT JOIN ProductBatches pb
                    ON pb.Id = s.BatchId

                WHERE
                    s.Id = @stockId
                    AND s.CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock record not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error("Get stock by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve stock"
        });
    }
}