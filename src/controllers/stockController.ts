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

export async function transferStock(
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
            fromWarehouseId,
            fromLocationId,
            toWarehouseId,
            toLocationId,
            batchId,
            quantity,
            notes
        } = req.body;

        const product = Number(productId);
        const fromWarehouse = Number(fromWarehouseId);
        const toWarehouse = Number(toWarehouseId);
        const qty = Number(quantity);

        const fromLocation =
            fromLocationId === null ||
            fromLocationId === undefined ||
            fromLocationId === ""
                ? null
                : Number(fromLocationId);

        const toLocation =
            toLocationId === null ||
            toLocationId === undefined ||
            toLocationId === ""
                ? null
                : Number(toLocationId);

        const batch =
            batchId === null ||
            batchId === undefined ||
            batchId === ""
                ? null
                : Number(batchId);

        // Basic validation
        if (!Number.isInteger(product)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        if (!Number.isInteger(fromWarehouse)) {
            return res.status(400).json({
                success: false,
                message: "Invalid source warehouse ID"
            });
        }

        if (!Number.isInteger(toWarehouse)) {
            return res.status(400).json({
                success: false,
                message: "Invalid destination warehouse ID"
            });
        }

        if (fromLocation !== null && !Number.isInteger(fromLocation)) {
            return res.status(400).json({
                success: false,
                message: "Invalid source location ID"
            });
        }

        if (toLocation !== null && !Number.isInteger(toLocation)) {
            return res.status(400).json({
                success: false,
                message: "Invalid destination location ID"
            });
        }

        if (batch !== null && !Number.isInteger(batch)) {
            return res.status(400).json({
                success: false,
                message: "Invalid batch ID"
            });
        }

        if (!Number.isFinite(qty) || qty <= 0) {
            return res.status(400).json({
                success: false,
                message: "Transfer quantity must be greater than zero"
            });
        }

        // Source and destination cannot be identical
        if (
            fromWarehouse === toWarehouse &&
            fromLocation === toLocation
        ) {
            return res.status(400).json({
                success: false,
                message: "Source and destination cannot be the same"
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

            if (!productResult.recordset[0].IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Product is inactive"
                });
            }

            /*
             * 2. Validate Source Warehouse
             */
            const sourceWarehouseResult = await new sql.Request(transaction)
                .input("companyId", req.user.companyId)
                .input("warehouseId", fromWarehouse)
                .query(`
                    SELECT Id, IsActive
                    FROM Warehouses
                    WHERE
                        Id = @warehouseId
                        AND CompanyId = @companyId
                `);

            if (sourceWarehouseResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Source warehouse not found"
                });
            }

            if (!sourceWarehouseResult.recordset[0].IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Source warehouse is inactive"
                });
            }

            /*
             * 3. Validate Destination Warehouse
             */
            const destinationWarehouseResult =
                await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("warehouseId", toWarehouse)
                    .query(`
                        SELECT Id, IsActive
                        FROM Warehouses
                        WHERE
                            Id = @warehouseId
                            AND CompanyId = @companyId
                    `);

            if (destinationWarehouseResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Destination warehouse not found"
                });
            }

            if (!destinationWarehouseResult.recordset[0].IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Destination warehouse is inactive"
                });
            }

            /*
             * 4. Validate Source Location
             */
            if (fromLocation !== null) {
                const result = await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("warehouseId", fromWarehouse)
                    .input("locationId", fromLocation)
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

                if (result.recordset.length === 0) {
                    await transaction.rollback();

                    return res.status(404).json({
                        success: false,
                        message: "Source location not found"
                    });
                }

                if (!result.recordset[0].IsActive) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Source location is inactive"
                    });
                }
            }

            /*
             * 5. Validate Destination Location
             */
            if (toLocation !== null) {
                const result = await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("warehouseId", toWarehouse)
                    .input("locationId", toLocation)
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

                if (result.recordset.length === 0) {
                    await transaction.rollback();

                    return res.status(404).json({
                        success: false,
                        message: "Destination location not found"
                    });
                }

                if (!result.recordset[0].IsActive) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message: "Destination location is inactive"
                    });
                }
            }

            /*
             * 6. Validate Batch
             */
            if (batch !== null) {
                const batchResult = await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("productId", product)
                    .input("batchId", batch)
                    .query(`
                        SELECT
                            Id,
                            IsActive
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
             * 7. Find source stock
             */
            const sourceStockResult = await new sql.Request(transaction)
                .input("companyId", req.user.companyId)
                .input("productId", product)
                .input("warehouseId", fromWarehouse)
                .input("locationId", fromLocation)
                .input("batchId", batch)
                .query(`
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
                            OR (
                                LocationId IS NULL
                                AND @locationId IS NULL
                            )
                        )
                        AND (
                            BatchId = @batchId
                            OR (
                                BatchId IS NULL
                                AND @batchId IS NULL
                            )
                        )
                    `);

            if (sourceStockResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Source stock record does not exist"
                });
            }

            const sourceStock = sourceStockResult.recordset[0];

            const sourceQuantity = Number(sourceStock.Quantity);
            const sourceAverageCost = Number(sourceStock.AverageCost);

            if (sourceQuantity < qty) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock. Available quantity: ${sourceQuantity}`
                });
            }

            const newSourceQuantity = sourceQuantity - qty;

            /*
             * 8. Update source stock
             */
            await new sql.Request(transaction)
                .input("stockId", sourceStock.Id)
                .input("quantity", newSourceQuantity)
                .query(`
                    UPDATE Stock
                    SET
                        Quantity = @quantity,
                        UpdatedAt = GETDATE()
                    WHERE Id = @stockId
                `);

            /*
             * 9. Find destination stock
             */
            const destinationStockResult =
                await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("productId", product)
                    .input("warehouseId", toWarehouse)
                    .input("locationId", toLocation)
                    .input("batchId", batch)
                    .query(`
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
                                OR (
                                    LocationId IS NULL
                                    AND @locationId IS NULL
                                )
                            )
                            AND (
                                BatchId = @batchId
                                OR (
                                    BatchId IS NULL
                                    AND @batchId IS NULL
                                )
                            )
                    `);

            let destinationStockId: number;
            let newDestinationQuantity: number;
            let destinationAverageCost: number;

            /*
             * 10. Update or create destination stock
             */
            if (destinationStockResult.recordset.length > 0) {

                const destinationStock =
                    destinationStockResult.recordset[0];

                const currentDestinationQuantity =
                    Number(destinationStock.Quantity);

                const currentDestinationAverageCost =
                    Number(destinationStock.AverageCost);

                newDestinationQuantity =
                    currentDestinationQuantity + qty;

                if (newDestinationQuantity > 0) {
                    destinationAverageCost =
                        (
                            (currentDestinationQuantity *
                                currentDestinationAverageCost) +
                            (qty * sourceAverageCost)
                        ) / newDestinationQuantity;
                } else {
                    destinationAverageCost = sourceAverageCost;
                }

                await new sql.Request(transaction)
                    .input("stockId", destinationStock.Id)
                    .input("quantity", newDestinationQuantity)
                    .input("averageCost", destinationAverageCost)
                    .query(`
                        UPDATE Stock
                        SET
                            Quantity = @quantity,
                            AverageCost = @averageCost,
                            UpdatedAt = GETDATE()
                        WHERE Id = @stockId
                    `);

                destinationStockId = destinationStock.Id;

            } else {

                newDestinationQuantity = qty;
                destinationAverageCost = sourceAverageCost;

                const insertDestination =
                    await new sql.Request(transaction)
                        .input("companyId", req.user.companyId)
                        .input("productId", product)
                        .input("warehouseId", toWarehouse)
                        .input("locationId", toLocation)
                        .input("batchId", batch)
                        .input("quantity", newDestinationQuantity)
                        .input("averageCost", destinationAverageCost)
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

                destinationStockId =
                    insertDestination.recordset[0].Id;
            }

            /*
             * 11. Create one transfer reference
             *
             * StockTransactions.ReferenceId is BIGINT.
             * We use the source transaction ID as the
             * common transfer reference.
             */
            const transferReference =
                Date.now();

            /*
             * 12. TRANSFER_OUT
             */
            const transferOutResult =
                await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("productId", product)
                    .input("warehouseId", fromWarehouse)
                    .input("locationId", fromLocation)
                    .input("batchId", batch)
                    .input("transactionType", "TRANSFER_OUT")
                    .input("referenceType", "STOCK_TRANSFER")
                    .input("referenceId", transferReference)
                    .input("quantity", -qty)
                    .input("unitCost", sourceAverageCost)
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

            /*
             * 13. TRANSFER_IN
             */
            const transferInResult =
                await new sql.Request(transaction)
                    .input("companyId", req.user.companyId)
                    .input("productId", product)
                    .input("warehouseId", toWarehouse)
                    .input("locationId", toLocation)
                    .input("batchId", batch)
                    .input("transactionType", "TRANSFER_IN")
                    .input("referenceType", "STOCK_TRANSFER")
                    .input("referenceId", transferReference)
                    .input("quantity", qty)
                    .input("unitCost", sourceAverageCost)
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

            /*
             * 14. Commit
             */
            await transaction.commit();

            return res.status(200).json({
                success: true,
                message: "Stock transferred successfully",
                referenceId: transferReference,
                transferOutTransactionId:
                    transferOutResult.recordset[0].Id,
                transferInTransactionId:
                    transferInResult.recordset[0].Id,
                sourceStockId: sourceStock.Id,
                destinationStockId,
                transferredQuantity: qty,
                sourcePreviousQuantity: sourceQuantity,
                sourceNewQuantity: newSourceQuantity,
                destinationNewQuantity: newDestinationQuantity,
                averageCost: sourceAverageCost
            });

        } catch (error) {

            console.error("Stock transfer transaction error:", error);

            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }

            throw error;
        }

    } catch (error) {

        console.error("Transfer stock error:", error);

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to transfer stock"
        });
    }
}

export async function getStockTransactions(
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
            productId,
            warehouseId,
            locationId,
            batchId,
            transactionType,
            dateFrom,
            dateTo
        } = req.query;

        const request = new sql.Request();

        request.input("companyId", req.user.companyId);

        let query = `
            SELECT
                st.Id,
                st.CompanyId,

                st.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                st.WarehouseId,
                w.Name AS WarehouseName,

                st.LocationId,
                wl.Name AS LocationName,

                st.BatchId,
                pb.BatchNumber,

                st.TransactionType,
                st.ReferenceType,
                st.ReferenceId,

                st.Quantity,
                st.UnitCost,
                st.TransactionDate,

                st.CreatedBy,
                u.FullName AS CreatedByName,

                st.Notes

            FROM StockTransactions st

            INNER JOIN Products p
                ON p.Id = st.ProductId

            INNER JOIN Warehouses w
                ON w.Id = st.WarehouseId

            LEFT JOIN WarehouseLocations wl
                ON wl.Id = st.LocationId

            LEFT JOIN ProductBatches pb
                ON pb.Id = st.BatchId

            LEFT JOIN Users u
                ON u.Id = st.CreatedBy

            WHERE
                st.CompanyId = @companyId
        `;

        if (productId) {
            query += ` AND st.ProductId = @productId`;

            request.input(
                "productId",
                Number(productId)
            );
        }

        if (warehouseId) {
            query += ` AND st.WarehouseId = @warehouseId`;

            request.input(
                "warehouseId",
                Number(warehouseId)
            );
        }

        if (locationId !== undefined) {
            if (locationId === "null") {

                query += `
                    AND st.LocationId IS NULL
                `;

            } else {

                query += `
                    AND st.LocationId = @locationId
                `;

                request.input(
                    "locationId",
                    Number(locationId)
                );
            }
        }

        if (batchId !== undefined) {
            if (batchId === "null") {

                query += `
                    AND st.BatchId IS NULL
                `;

            } else {

                query += `
                    AND st.BatchId = @batchId
                `;

                request.input(
                    "batchId",
                    Number(batchId)
                );
            }
        }

        if (transactionType) {
            query += `
                AND st.TransactionType = @transactionType
            `;

            request.input(
                "transactionType",
                String(transactionType)
            );
        }

        if (dateFrom) {
            query += `
                AND st.TransactionDate >= @dateFrom
            `;

            request.input(
                "dateFrom",
                new Date(String(dateFrom))
            );
        }

        if (dateTo) {
            query += `
                AND st.TransactionDate < DATEADD(DAY, 1, @dateTo)
            `;

            request.input(
                "dateTo",
                new Date(String(dateTo))
            );
        }

        query += `
            ORDER BY
                st.TransactionDate DESC,
                st.Id DESC
        `;

        const result = await request.query(query);

        return res.status(200).json({
            success: true,
            count: result.recordset.length,
            transactions: result.recordset
        });

    } catch (error) {

        console.error(
            "Get stock transactions error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock transactions"
        });
    }
}

export async function getStockTransactionById(
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

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID"
            });
        }

        const request = new sql.Request();

        request
            .input("companyId", req.user.companyId)
            .input("id", id);

        const result = await request.query(`
            SELECT
                st.Id,
                st.CompanyId,

                st.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                st.WarehouseId,
                w.Name AS WarehouseName,

                st.LocationId,
                wl.Name AS LocationName,

                st.BatchId,
                pb.BatchNumber,

                st.TransactionType,
                st.ReferenceType,
                st.ReferenceId,

                st.Quantity,
                st.UnitCost,
                st.TransactionDate,

                st.CreatedBy,
                u.FullName AS CreatedByName,

                st.Notes

            FROM StockTransactions st

            INNER JOIN Products p
                ON p.Id = st.ProductId

            INNER JOIN Warehouses w
                ON w.Id = st.WarehouseId

            LEFT JOIN WarehouseLocations wl
                ON wl.Id = st.LocationId

            LEFT JOIN ProductBatches pb
                ON pb.Id = st.BatchId

            LEFT JOIN Users u
                ON u.Id = st.CreatedBy

            WHERE
                st.Id = @id
                AND st.CompanyId = @companyId
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock transaction not found"
            });
        }

        return res.status(200).json({
            success: true,
            transaction: result.recordset[0]
        });

    } catch (error) {

        console.error(
            "Get stock transaction by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock transaction"
        });
    }
}

// =====================================================
// GET STOCK ADJUSTMENTS
// =====================================================

export async function getStockAdjustments(
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

        const result = await request.query(`
            SELECT
                sa.Id,
                sa.CompanyId,
                sa.WarehouseId,
                w.Name AS WarehouseName,
                sa.Reason,
                sa.Status,
                sa.CreatedBy,
                u.FullName AS CreatedByName,
                sa.CreatedAt
            FROM StockAdjustments sa

            LEFT JOIN Warehouses w
                ON w.Id = sa.WarehouseId

            LEFT JOIN Users u
                ON u.Id = sa.CreatedBy

            WHERE sa.CompanyId = @companyId

            ORDER BY
                sa.Id DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get stock adjustments error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock adjustments"
        });
    }
}

// =====================================================
// GET STOCK ADJUSTMENT BY ID
// =====================================================

export async function getStockAdjustmentById(
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

        const adjustmentId =
            Number(req.params.id);

        if (!Number.isInteger(adjustmentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid adjustment ID"
            });
        }

        const db = getDatabase();

        // =============================================
        // HEADER
        // =============================================

        const headerRequest = db.request()
            .input("id", adjustmentId)
            .input("companyId", req.user.companyId);

        const headerResult =
            await headerRequest.query(`
                SELECT
                    sa.Id,
                    sa.CompanyId,
                    sa.WarehouseId,
                    w.Name AS WarehouseName,
                    sa.Reason,
                    sa.Status,
                    sa.CreatedBy,
                    u.FullName AS CreatedByName,
                    sa.CreatedAt
                FROM StockAdjustments sa

                LEFT JOIN Warehouses w
                    ON w.Id = sa.WarehouseId

                LEFT JOIN Users u
                    ON u.Id = sa.CreatedBy

                WHERE
                    sa.Id = @id
                    AND sa.CompanyId = @companyId
            `);

        if (headerResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock adjustment not found"
            });
        }

        // =============================================
        // ITEMS
        // =============================================

        const itemsRequest = db.request()
            .input(
                "adjustmentId",
                adjustmentId
            );

        const itemsResult =
            await itemsRequest.query(`
                SELECT
                    sai.Id,
                    sai.StockAdjustmentId,
                    sai.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,
                    sai.LocationId,
                    wl.Name AS LocationName,
                    sai.BatchId,
                    pb.BatchNumber,
                    sai.Quantity,
                    sai.AdjustmentType,
                    sai.UnitCost,
                    sai.Notes
                FROM StockAdjustmentItems sai

                INNER JOIN Products p
                    ON p.Id = sai.ProductId

                LEFT JOIN WarehouseLocations wl
                    ON wl.Id = sai.LocationId

                LEFT JOIN ProductBatches pb
                    ON pb.Id = sai.BatchId

                WHERE
                    sai.StockAdjustmentId =
                        @adjustmentId

                ORDER BY
                    sai.Id
            `);

        return res.status(200).json({
            success: true,
            data: {
                adjustment:
                    headerResult.recordset[0],

                items:
                    itemsResult.recordset
            }
        });

    } catch (error) {

        console.error(
            "Get stock adjustment by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock adjustment"
        });
    }
}

// =====================================================
// GET STOCK TRANSFERS
// =====================================================

export async function getStockTransfers(
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

        const result = await request.query(`
            SELECT
                st.Id,
                st.CompanyId,

                st.FromBranchId,
                fb.Name AS FromBranchName,

                st.FromWarehouseId,
                fw.Name AS FromWarehouseName,

                st.ToBranchId,
                tb.Name AS ToBranchName,

                st.ToWarehouseId,
                tw.Name AS ToWarehouseName,

                st.TransferNumber,
                st.TransferDate,
                st.Status,
                st.Notes,

                st.CreatedBy,
                u.FullName AS CreatedByName,

                st.CreatedAt,
                st.UpdatedAt

            FROM StockTransfers st

            LEFT JOIN Branches fb
                ON fb.Id = st.FromBranchId

            LEFT JOIN Warehouses fw
                ON fw.Id = st.FromWarehouseId

            LEFT JOIN Branches tb
                ON tb.Id = st.ToBranchId

            LEFT JOIN Warehouses tw
                ON tw.Id = st.ToWarehouseId

            LEFT JOIN Users u
                ON u.Id = st.CreatedBy

            WHERE
                st.CompanyId = @companyId

            ORDER BY
                st.TransferDate DESC,
                st.Id DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get stock transfers error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock transfers"
        });
    }
}

// =====================================================
// GET STOCK TRANSFER BY ID
// =====================================================

export async function getStockTransferById(
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

        const transferId =
            Number(req.params.id);

        if (!Number.isInteger(transferId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer ID"
            });
        }

        const db = getDatabase();

        // =============================================
        // HEADER
        // =============================================

        const headerRequest = db.request()
            .input("id", transferId)
            .input(
                "companyId",
                req.user.companyId
            );

        const headerResult =
            await headerRequest.query(`
                SELECT
                    st.Id,
                    st.CompanyId,

                    st.FromBranchId,
                    fb.Name AS FromBranchName,

                    st.FromWarehouseId,
                    fw.Name AS FromWarehouseName,

                    st.ToBranchId,
                    tb.Name AS ToBranchName,

                    st.ToWarehouseId,
                    tw.Name AS ToWarehouseName,

                    st.TransferNumber,
                    st.TransferDate,
                    st.Status,
                    st.Notes,

                    st.CreatedBy,
                    u.FullName AS CreatedByName,

                    st.CreatedAt,
                    st.UpdatedAt

                FROM StockTransfers st

                LEFT JOIN Branches fb
                    ON fb.Id = st.FromBranchId

                LEFT JOIN Warehouses fw
                    ON fw.Id = st.FromWarehouseId

                LEFT JOIN Branches tb
                    ON tb.Id = st.ToBranchId

                LEFT JOIN Warehouses tw
                    ON tw.Id = st.ToWarehouseId

                LEFT JOIN Users u
                    ON u.Id = st.CreatedBy

                WHERE
                    st.Id = @id
                    AND st.CompanyId = @companyId
            `);

        if (headerResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock transfer not found"
            });
        }

        // =============================================
        // ITEMS
        // =============================================

        const itemsRequest = db.request()
            .input(
                "transferId",
                transferId
            );

        const itemsResult =
            await itemsRequest.query(`
                SELECT
                    sti.Id,
                    sti.StockTransferId,

                    sti.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,

                    sti.BatchId,
                    pb.BatchNumber,

                    sti.Quantity,

                    sti.FromLocationId,
                    fl.Name AS FromLocationName,

                    sti.ToLocationId,
                    tl.Name AS ToLocationName,

                    sti.UnitCost,
                    sti.Notes

                FROM StockTransferItems sti

                INNER JOIN Products p
                    ON p.Id = sti.ProductId

                LEFT JOIN ProductBatches pb
                    ON pb.Id = sti.BatchId

                LEFT JOIN WarehouseLocations fl
                    ON fl.Id = sti.FromLocationId

                LEFT JOIN WarehouseLocations tl
                    ON tl.Id = sti.ToLocationId

                WHERE
                    sti.StockTransferId =
                        @transferId

                ORDER BY
                    sti.Id
            `);

        return res.status(200).json({
            success: true,

            data: {
                transfer:
                    headerResult.recordset[0],

                items:
                    itemsResult.recordset
            }
        });

    } catch (error) {

        console.error(
            "Get stock transfer by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock transfer"
        });
    }
}