import { Response } from "express";
import sql from "mssql";
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

export async function adjustStock(
    req: AuthRequest,
    res: Response
) {
    const db = getDatabase();

    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const {
            productId,
            warehouseId,
            locationId,
            batchId,
            quantity,
            unitCost,
            notes
        } = req.body;

        // Basic validation
        if (!Number.isInteger(Number(productId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        if (!Number.isInteger(Number(warehouseId))) {
            return res.status(400).json({
                success: false,
                message: "Invalid warehouse ID"
            });
        }

        if (
            quantity === undefined ||
            quantity === null ||
            Number(quantity) === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Quantity cannot be zero"
            });
        }

        if (
            unitCost === undefined ||
            unitCost === null ||
            Number(unitCost) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid unit cost"
            });
        }

        const product = Number(productId);
        const warehouse = Number(warehouseId);
        const qty = Number(quantity);
        const cost = Number(unitCost);

        const location =
            locationId === null ||
            locationId === undefined ||
            locationId === ""
                ? null
                : Number(locationId);

        const batch =
            batchId === null ||
            batchId === undefined ||
            batchId === ""
                ? null
                : Number(batchId);

        if (location !== null && !Number.isInteger(location)) {
            return res.status(400).json({
                success: false,
                message: "Invalid location ID"
            });
        }

        if (batch !== null && !Number.isInteger(batch)) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        const transaction = new sql.Transaction(db);

        await transaction.begin();

        try {

            /*
             * 1. Validate Product
             */
            const productResult = await new sql.Request(transaction)
                .input("companyId", req.user.companyId)
                .input("productId", product)
                .query(`
                    SELECT
                        Id,
                        HasBatch,
                        HasExpiry,
                        IsActive
                    FROM Products
                    WHERE
                        Id = @productId
                        AND CompanyId = @companyId
                `);

            if (productResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const productData = productResult.recordset[0];

            if (!productData.IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Product is inactive"
                });
            }

            /*
             * 2. Validate Warehouse
             */
            const warehouseResult = await new sql.Request(transaction)
                .input("companyId", req.user.companyId)
                .input("warehouseId", warehouse)
                .query(`
                    SELECT Id, IsActive
                    FROM Warehouses
                    WHERE
                        Id = @warehouseId
                        AND CompanyId = @companyId
                `);

            if (warehouseResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Warehouse not found"
                });
            }

            if (!warehouseResult.recordset[0].IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Warehouse is inactive"
                });
            }

            /*
             * 3. Validate Location
             */
            if (location !== null) {

                const locationResult =
                    await new sql.Request(transaction)
                        .input("companyId", req.user.companyId)
                        .input("warehouseId", warehouse)
                        .input("locationId", location)
                        .query(`
                            SELECT
                                wl.Id,
                                wl.IsActive
                            FROM WarehouseLocations wl
                            INNER JOIN Warehouses w
                                ON w.Id = wl.WarehouseId
                            WHERE
                                wl.Id = @locationId
                                AND wl.WarehouseId = @warehouseId
                                AND w.CompanyId = @companyId
                        `);

                if (locationResult.recordset.length === 0) {
                    await transaction.rollback();

                    return res.status(404).json({
                        success: false,
                        message: "Warehouse location not found"
                    });
                }

                if (!locationResult.recordset[0].IsActive) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Warehouse location is inactive"
                    });
                }
            }

            /*
             * 4. Validate Batch
             */
            if (batch !== null) {

                const batchResult =
                    await new sql.Request(transaction)
                        .input("companyId", req.user.companyId)
                        .input("productId", product)
                        .input("batchId", batch)
                        .query(`
                            SELECT
                                Id,
                                IsActive,
                                CostPrice
                            FROM ProductBatches
                            WHERE
                                Id = @batchId
                                AND ProductId = @productId
                                AND CompanyId = @companyId
                        `);

                if (batchResult.recordset.length === 0) {
                    await transaction.rollback();

                    return res.status(404).json({
                        success: false,
                        message: "Product batch not found"
                    });
                }

                if (!batchResult.recordset[0].IsActive) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Product batch is inactive"
                    });
                }
            }

            /*
             * 5. Find existing stock
             *
             * We handle NULL LocationId and NULL BatchId
             * explicitly because SQL NULL != NULL.
             */
            const stockRequest =
                new sql.Request(transaction);

            stockRequest
                .input("companyId", req.user.companyId)
                .input("productId", product)
                .input("warehouseId", warehouse)
                .input("locationId", location)
                .input("batchId", batch);

            const stockResult = await stockRequest.query(`
                SELECT TOP 1
                    Id,
                    Quantity,
                    AverageCost
                FROM Stock
                WHERE
                    CompanyId = @companyId
                    AND ProductId = @productId
                    AND WarehouseId = @warehouseId
                    AND (
                        LocationId = @locationId
                        OR (LocationId IS NULL AND @locationId IS NULL)
                    )
                    AND (
                        BatchId = @batchId
                        OR (BatchId IS NULL AND @batchId IS NULL)
                    )
            `);

            let stockId: number;
            let newQuantity: number;
            let newAverageCost: number;

            /*
             * 6. Existing Stock
             */
            if (stockResult.recordset.length > 0) {

                const existingStock = stockResult.recordset[0];

                const currentQuantity =
                    Number(existingStock.Quantity);

                const currentAverageCost =
                    Number(existingStock.AverageCost);

                newQuantity = currentQuantity + qty;

                /*
                 * Stock cannot become negative
                 */
                if (newQuantity < 0) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock. Available quantity: ${currentQuantity}`
                    });
                }

                /*
                 * Weighted average cost when adding stock.
                 *
                 * If quantity is negative, we keep the existing
                 * average cost because we are removing stock.
                 */
                if (qty > 0 && newQuantity > 0) {
                    newAverageCost =
                        (
                            (currentQuantity * currentAverageCost) +
                            (qty * cost)
                        ) / newQuantity;
                } else {
                    newAverageCost = currentAverageCost;
                }

                const updateRequest =
                    new sql.Request(transaction);

                await updateRequest
                    .input("stockId", existingStock.Id)
                    .input("quantity", newQuantity)
                    .input("averageCost", newAverageCost)
                    .query(`
                        UPDATE Stock
                        SET
                            Quantity = @quantity,
                            AverageCost = @averageCost,
                            UpdatedAt = GETDATE()
                        WHERE
                            Id = @stockId
                    `);

                stockId = existingStock.Id;
            }

            /*
             * 7. New Stock
             */
            else {

                if (qty < 0) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Cannot decrease stock because no stock record exists"
                    });
                }

                newQuantity = qty;
                newAverageCost = cost;

                const insertRequest =
                    new sql.Request(transaction);

                const insertResult =
                    await insertRequest
                        .input("companyId", req.user.companyId)
                        .input("productId", product)
                        .input("warehouseId", warehouse)
                        .input("locationId", location)
                        .input("batchId", batch)
                        .input("quantity", newQuantity)
                        .input("averageCost", newAverageCost)
                        .query(`
                            INSERT INTO Stock
                            (
                                CompanyId,
                                ProductId,
                                WarehouseId,
                                LocationId,
                                BatchId,
                                Quantity,
                                AverageCost,
                                UpdatedAt
                            )
                            OUTPUT INSERTED.Id
                            VALUES
                            (
                                @companyId,
                                @productId,
                                @warehouseId,
                                @locationId,
                                @batchId,
                                @quantity,
                                @averageCost,
                                GETDATE()
                            )
                        `);

                stockId = insertResult.recordset[0].Id;
            }

            /*
             * 8. Record Stock Transaction
             */
            const transactionRequest =
                new sql.Request(transaction);

            const transactionResult =
                await transactionRequest
                    .input("companyId", req.user.companyId)
                    .input("productId", product)
                    .input("warehouseId", warehouse)
                    .input("locationId", location)
                    .input("batchId", batch)
                    .input("transactionType", "ADJUSTMENT")
                    .input("referenceType", "STOCK_ADJUSTMENT")
                    .input("referenceId", stockId)
                    .input("quantity", qty)
                    .input("unitCost", cost)
                    .input("createdBy", req.user.userId)
                    .input("notes", notes?.trim() || null)
                    .query(`
                        INSERT INTO StockTransactions
                        (
                            CompanyId,
                            ProductId,
                            WarehouseId,
                            LocationId,
                            BatchId,
                            TransactionType,
                            ReferenceType,
                            ReferenceId,
                            Quantity,
                            UnitCost,
                            TransactionDate,
                            CreatedBy,
                            Notes
                        )
                        OUTPUT INSERTED.Id
                        VALUES
                        (
                            @companyId,
                            @productId,
                            @warehouseId,
                            @locationId,
                            @batchId,
                            @transactionType,
                            @referenceType,
                            @referenceId,
                            @quantity,
                            @unitCost,
                            GETDATE(),
                            @createdBy,
                            @notes
                        )
                    `);

            const transactionId =
                transactionResult.recordset[0].Id;

            /*
             * 9. Commit
             */
            await transaction.commit();

            return res.status(200).json({
                success: true,
                message: "Stock adjusted successfully",
                stockId,
                transactionId,
                previousQuantity:
                    stockResult.recordset.length > 0
                        ? Number(stockResult.recordset[0].Quantity)
                        : 0,
                adjustmentQuantity: qty,
                newQuantity,
                averageCost: newAverageCost
            });

        } catch (error) {

             console.error("Transaction error:", error);

    try {
        await transaction.rollback();
    } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
    }

    throw error;
        }

    } catch (error) {

        console.error("Adjust stock error:", error);

return res.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : String(error)
});
    }
}