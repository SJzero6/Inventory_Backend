import { Response } from "express";
import sql from "mssql";
import { AuthRequest } from "../middleware/authMiddleware";
import { getDatabase } from "../config/database";


// =====================================================
// CREATE GOODS RECEIPT
// =====================================================

export async function createGoodsReceipt(
    req: AuthRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const {
        branchId,
        warehouseId,
        supplierId,
        purchaseOrderId,
        receiptNumber,
        receiptDate,
        notes,
        items
    } = req.body;

    if (
        !branchId ||
        !warehouseId ||
        !supplierId ||
        !receiptNumber ||
        !receiptDate
    ) {
        return res.status(400).json({
            success: false,
            message:
                "Branch, warehouse, supplier, receipt number and receipt date are required"
        });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "At least one receipt item is required"
        });
    }

    const db = getDatabase();
    const transaction = new sql.Transaction(db);

    try {
        await transaction.begin();

        // =================================================
        // 1. CHECK DUPLICATE RECEIPT NUMBER
        // =================================================

        const duplicateRequest =
            new sql.Request(transaction);

        duplicateRequest
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "receiptNumber",
                receiptNumber
            );

        const duplicateResult =
            await duplicateRequest.query(`
                SELECT Id
                FROM GoodsReceipts
                WHERE
                    CompanyId = @companyId
                    AND ReceiptNumber = @receiptNumber
            `);

        if (duplicateResult.recordset.length > 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "Receipt number already exists"
            });
        }

        // =================================================
        // 2. GET PURCHASE ORDER
        // =================================================

        let purchaseOrder: any = null;

        if (purchaseOrderId) {

            const poRequest =
                new sql.Request(transaction);

            poRequest
                .input(
                    "purchaseOrderId",
                    Number(purchaseOrderId)
                )
                .input(
                    "companyId",
                    req.user.companyId
                );

            const poResult =
                await poRequest.query(`
                    SELECT
                        Id,
                        CompanyId,
                        BranchId,
                        WarehouseId,
                        SupplierId,
                        Status
                    FROM PurchaseOrders
                    WHERE
                        Id = @purchaseOrderId
                        AND CompanyId = @companyId
                `);

            if (poResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Purchase order not found"
                });
            }

            purchaseOrder =
                poResult.recordset[0];

            if (purchaseOrder.Status !== "APPROVED" &&
                purchaseOrder.Status !== "PARTIALLY_RECEIVED") {

                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Goods cannot be received for purchase order with status ${purchaseOrder.Status}`
                });
            }

            // Make sure receipt belongs to same PO
            if (
                Number(branchId) !==
                Number(purchaseOrder.BranchId)
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Branch does not match purchase order"
                });
            }

            if (
                Number(warehouseId) !==
                Number(purchaseOrder.WarehouseId)
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Warehouse does not match purchase order"
                });
            }

            if (
                Number(supplierId) !==
                Number(purchaseOrder.SupplierId)
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Supplier does not match purchase order"
                });
            }
        }

        // =================================================
        // 3. CREATE GOODS RECEIPT
        // =================================================

        const receiptRequest =
            new sql.Request(transaction);

        receiptRequest
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "branchId",
                Number(branchId)
            )
            .input(
                "warehouseId",
                Number(warehouseId)
            )
            .input(
                "supplierId",
                Number(supplierId)
            )
            .input(
                "purchaseOrderId",
                purchaseOrderId
                    ? Number(purchaseOrderId)
                    : null
            )
            .input(
                "receiptNumber",
                receiptNumber
            )
            .input(
                "receiptDate",
                new Date(receiptDate)
            )
            .input(
                "status",
                "RECEIVED"
            )
            .input(
                "notes",
                notes || null
            )
            .input(
                "createdBy",
                req.user.userId
            );

        const receiptResult =
            await receiptRequest.query(`
                INSERT INTO GoodsReceipts
                (
                    CompanyId,
                    BranchId,
                    WarehouseId,
                    SupplierId,
                    PurchaseOrderId,
                    ReceiptNumber,
                    ReceiptDate,
                    Status,
                    Notes,
                    CreatedBy,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @branchId,
                    @warehouseId,
                    @supplierId,
                    @purchaseOrderId,
                    @receiptNumber,
                    @receiptDate,
                    @status,
                    @notes,
                    @createdBy,
                    GETDATE()
                )
            `);

        const goodsReceiptId =
            receiptResult.recordset[0].Id;

        // =================================================
        // 4. PROCESS EACH RECEIPT ITEM
        // =================================================

        for (const item of items) {

            const productId =
                Number(item.productId);

            const receivedQuantity =
                Number(item.receivedQuantity);

            const unitCost =
                Number(item.unitCost);

            const locationId =
                item.locationId !== null &&
                item.locationId !== undefined
                    ? Number(item.locationId)
                    : null;

            const batchNumber =
                item.batchNumber
                    ? String(item.batchNumber).trim()
                    : null;

            const expiryDate =
                item.expiryDate
                    ? new Date(item.expiryDate)
                    : null;

            const manufactureDate =
                item.manufactureDate
                    ? new Date(item.manufactureDate)
                    : null;

            if (
                !Number.isInteger(productId) ||
                receivedQuantity <= 0 ||
                unitCost < 0
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid product, quantity or unit cost"
                });
            }

            // =================================================
            // 4A. CHECK PRODUCT
            // =================================================

            const productRequest =
                new sql.Request(transaction);

            productRequest
                .input(
                    "productId",
                    productId
                )
                .input(
                    "companyId",
                    req.user.companyId
                );

            const productResult =
                await productRequest.query(`
                    SELECT
                        Id,
                        Name,
                        HasBatch,
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
                    message:
                        `Product ${productId} not found`
                });
            }

            const product =
                productResult.recordset[0];

            if (!product.IsActive) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Product ${productId} is inactive`
                });
            }

            // =================================================
            // 4B. GET PO ITEM
            // =================================================

            let poItem: any = null;

            if (purchaseOrderId) {

                const poItemRequest =
                    new sql.Request(transaction);

                poItemRequest
                    .input(
                        "purchaseOrderId",
                        Number(purchaseOrderId)
                    )
                    .input(
                        "productId",
                        productId
                    );

                const poItemResult =
    await poItemRequest.query(`
        SELECT TOP 1
            Id,
            OrderedQuantity,
            ReceivedQuantity,
            UnitCost
        FROM PurchaseOrderItems WITH (UPDLOCK, ROWLOCK)
        WHERE
            PurchaseOrderId = @purchaseOrderId
            AND ProductId = @productId
        ORDER BY Id
    `);

                if (poItemResult.recordset.length === 0) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            `Product ${productId} is not part of the purchase order`
                    });
                }

                poItem =
                    poItemResult.recordset[0];

                const remainingQuantity =
                    Number(poItem.OrderedQuantity) -
                    Number(poItem.ReceivedQuantity);

                if (
                    receivedQuantity >
                    remainingQuantity
                ) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            `Cannot receive ${receivedQuantity} units of product ${productId}. Remaining quantity is ${remainingQuantity}`
                    });
                }
            }

            // =================================================
            // 4C. BATCH HANDLING
            // =================================================

            let batchId: number | null = null;

            if (product.HasBatch) {

                if (!batchNumber) {
                    await transaction.rollback();

                    return res.status(400).json({
                        success: false,
                        message:
                            `Batch number is required for product ${productId}`
                    });
                }

                // Find existing batch
                const batchRequest =
                    new sql.Request(transaction);

                batchRequest
                    .input(
                        "companyId",
                        req.user.companyId
                    )
                    .input(
                        "productId",
                        productId
                    )
                    .input(
                        "batchNumber",
                        batchNumber
                    );

                const batchResult =
                    await batchRequest.query(`
                        SELECT
                            Id
                        FROM ProductBatches
                        WHERE
                            CompanyId = @companyId
                            AND ProductId = @productId
                            AND BatchNumber = @batchNumber
                            AND IsActive = 1
                    `);

                if (batchResult.recordset.length > 0) {

                    batchId =
                        batchResult.recordset[0].Id;

                    // Update expiry/cost if supplied
                    const updateBatchRequest =
                        new sql.Request(transaction);

                    updateBatchRequest
                        .input(
                            "batchId",
                            batchId
                        )
                        .input(
                            "expiryDate",
                            expiryDate
                        )
                        .input(
                            "costPrice",
                            unitCost
                        );

                    await updateBatchRequest.query(`
                        UPDATE ProductBatches
                        SET
                            ExpiryDate =
                                COALESCE(
                                    @expiryDate,
                                    ExpiryDate
                                ),
                            CostPrice =
                                @costPrice
                        WHERE Id = @batchId
                    `);

                } else {

                    // Create new batch
                    const createBatchRequest =
                        new sql.Request(transaction);

                    createBatchRequest
                        .input(
                            "companyId",
                            req.user.companyId
                        )
                        .input(
                            "productId",
                            productId
                        )
                        .input(
                            "batchNumber",
                            batchNumber
                        )
                        .input(
                            "manufactureDate",
                            manufactureDate
                        )
                        .input(
                            "expiryDate",
                            expiryDate
                        )
                        .input(
                            "costPrice",
                            unitCost
                        );

                    const newBatchResult =
                        await createBatchRequest.query(`
                            INSERT INTO ProductBatches
                            (
                                CompanyId,
                                ProductId,
                                BatchNumber,
                                ManufactureDate,
                                ExpiryDate,
                                CostPrice,
                                IsActive,
                                CreatedAt
                            )
                            OUTPUT INSERTED.Id
                            VALUES
                            (
                                @companyId,
                                @productId,
                                @batchNumber,
                                @manufactureDate,
                                @expiryDate,
                                @costPrice,
                                1,
                                GETDATE()
                            )
                        `);

                    batchId =
                        newBatchResult.recordset[0].Id;
                }

            } else if (batchNumber) {

                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Product ${productId} does not support batches`
                });
            }

            // =================================================
            // 4D. INSERT GOODS RECEIPT ITEM
            // =================================================

            const receiptItemRequest =
                new sql.Request(transaction);

            receiptItemRequest
                .input(
                    "goodsReceiptId",
                    goodsReceiptId
                )
                .input(
                    "productId",
                    productId
                )
                .input(
                    "batchId",
                    batchId
                )
                .input(
                    "locationId",
                    locationId
                )
                .input(
                    "receivedQuantity",
                    receivedQuantity
                )
                .input(
                    "unitCost",
                    unitCost
                )
                .input(
                    "expiryDate",
                    expiryDate
                )
                .input(
                    "notes",
                    item.notes || null
                );

            await receiptItemRequest.query(`
                INSERT INTO GoodsReceiptItems
                (
                    GoodsReceiptId,
                    ProductId,
                    BatchId,
                    LocationId,
                    ReceivedQuantity,
                    UnitCost,
                    ExpiryDate,
                    Notes
                )
                VALUES
                (
                    @goodsReceiptId,
                    @productId,
                    @batchId,
                    @locationId,
                    @receivedQuantity,
                    @unitCost,
                    @expiryDate,
                    @notes
                )
            `);

            // =================================================
            // 4E. FIND EXISTING STOCK
            // =================================================

            const stockRequest =
                new sql.Request(transaction);

            stockRequest
                .input(
                    "companyId",
                    req.user.companyId
                )
                .input(
                    "productId",
                    productId
                )
                .input(
                    "warehouseId",
                    Number(warehouseId)
                )
                .input(
                    "locationId",
                    locationId
                )
                .input(
                    "batchId",
                    batchId
                );

            const stockResult =
                await stockRequest.query(`
                    SELECT
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

            // =================================================
            // 4F. UPDATE / CREATE STOCK
            // =================================================

            if (stockResult.recordset.length > 0) {

                const stock =
                    stockResult.recordset[0];

                const oldQuantity =
                    Number(stock.Quantity);

                const oldAverageCost =
                    Number(stock.AverageCost);

                const newQuantity =
                    oldQuantity +
                    receivedQuantity;

                const newAverageCost =
                    newQuantity === 0
                        ? unitCost
                        :
                        (
                            (
                                oldQuantity *
                                oldAverageCost
                            ) +
                            (
                                receivedQuantity *
                                unitCost
                            )
                        ) / newQuantity;

                const updateStockRequest =
                    new sql.Request(transaction);

                updateStockRequest
                    .input(
                        "id",
                        stock.Id
                    )
                    .input(
                        "quantity",
                        newQuantity
                    )
                    .input(
                        "averageCost",
                        newAverageCost
                    );

                await updateStockRequest.query(`
                    UPDATE Stock
                    SET
                        Quantity = @quantity,
                        AverageCost = @averageCost,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);

            } else {

                const createStockRequest =
                    new sql.Request(transaction);

                createStockRequest
                    .input(
                        "companyId",
                        req.user.companyId
                    )
                    .input(
                        "productId",
                        productId
                    )
                    .input(
                        "warehouseId",
                        Number(warehouseId)
                    )
                    .input(
                        "locationId",
                        locationId
                    )
                    .input(
                        "batchId",
                        batchId
                    )
                    .input(
                        "quantity",
                        receivedQuantity
                    )
                    .input(
                        "averageCost",
                        unitCost
                    );

                await createStockRequest.query(`
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
            }

            // =================================================
            // 4G. CREATE STOCK TRANSACTION
            // =================================================

            const transactionRequest =
                new sql.Request(transaction);

            transactionRequest
                .input(
                    "companyId",
                    req.user.companyId
                )
                .input(
                    "productId",
                    productId
                )
                .input(
                    "warehouseId",
                    Number(warehouseId)
                )
                .input(
                    "locationId",
                    locationId
                )
                .input(
                    "batchId",
                    batchId
                )
                .input(
                    "transactionType",
                    "RECEIPT"
                )
                .input(
                    "referenceType",
                    "GOODS_RECEIPT"
                )
                .input(
                    "referenceId",
                    goodsReceiptId
                )
                .input(
                    "quantity",
                    receivedQuantity
                )
                .input(
                    "unitCost",
                    unitCost
                )
                .input(
                    "createdBy",
                    req.user.userId
                )
                .input(
                    "notes",
                    `Goods receipt ${receiptNumber}`
                );

            await transactionRequest.query(`
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

            // =================================================
            // 4H. UPDATE PO RECEIVED QUANTITY
            // =================================================

            if (purchaseOrderId && poItem) {

                const newReceivedQuantity =
                    Number(poItem.ReceivedQuantity) +
                    receivedQuantity;

                const updatePOItemRequest =
                    new sql.Request(transaction);

                updatePOItemRequest
                    .input(
                        "id",
                        poItem.Id
                    )
                    .input(
                        "receivedQuantity",
                        newReceivedQuantity
                    );

                await updatePOItemRequest.query(`
                    UPDATE PurchaseOrderItems
                    SET
                        ReceivedQuantity =
                            @receivedQuantity
                    WHERE Id = @id
                `);
            }
        }

        // =================================================
        // 5. UPDATE PURCHASE ORDER STATUS
        // =================================================

        if (purchaseOrderId) {

            const statusRequest =
                new sql.Request(transaction);

            statusRequest
                .input(
                    "purchaseOrderId",
                    Number(purchaseOrderId)
                );

            const statusResult =
                await statusRequest.query(`
                    SELECT
                        SUM(OrderedQuantity)
                            AS TotalOrdered,

                        SUM(ReceivedQuantity)
                            AS TotalReceived
                    FROM PurchaseOrderItems
                    WHERE PurchaseOrderId =
                        @purchaseOrderId
                `);

            const totals =
                statusResult.recordset[0];

            const totalOrdered =
                Number(totals.TotalOrdered || 0);

            const totalReceived =
                Number(totals.TotalReceived || 0);

            let newStatus =
                "PARTIALLY_RECEIVED";

            if (
                totalOrdered > 0 &&
                totalReceived >= totalOrdered
            ) {
                newStatus =
                    "FULLY_RECEIVED";
            }

            const updatePORequest =
                new sql.Request(transaction);

            updatePORequest
                .input(
                    "purchaseOrderId",
                    Number(purchaseOrderId)
                )
                .input(
                    "status",
                    newStatus
                );

            await updatePORequest.query(`
                UPDATE PurchaseOrders
                SET
                    Status = @status,
                    UpdatedAt = GETDATE()
                WHERE Id = @purchaseOrderId
            `);
        }

        // =================================================
        // 6. COMMIT
        // =================================================

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message:
                "Goods receipt created successfully",
            goodsReceiptId
        });

    } catch (error) {

        try {
            await transaction.rollback();
        } catch {}

        console.error(
            "Create goods receipt error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create goods receipt"
        });
    }
}
// =====================================================
// GET ALL GOODS RECEIPTS
// =====================================================

export async function getGoodsReceipts(
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
            .input(
                "companyId",
                req.user.companyId
            );

        const result = await request.query(`
            SELECT
                gr.Id,
                gr.CompanyId,
                gr.BranchId,
                b.Name AS BranchName,
                gr.WarehouseId,
                w.Name AS WarehouseName,
                gr.SupplierId,
                s.Name AS SupplierName,
                gr.PurchaseOrderId,
                po.PurchaseOrderNumber,
                gr.ReceiptNumber,
                gr.ReceiptDate,
                gr.Status,
                gr.Notes,
                gr.CreatedBy,
                u.FullName AS CreatedByName,
                gr.CreatedAt
            FROM GoodsReceipts gr

            LEFT JOIN Branches b
                ON b.Id = gr.BranchId

            LEFT JOIN Warehouses w
                ON w.Id = gr.WarehouseId

            LEFT JOIN Suppliers s
                ON s.Id = gr.SupplierId

            LEFT JOIN PurchaseOrders po
                ON po.Id = gr.PurchaseOrderId

            LEFT JOIN Users u
                ON u.Id = gr.CreatedBy

            WHERE gr.CompanyId = @companyId

            ORDER BY gr.Id DESC
        `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get goods receipts error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get goods receipts"
        });
    }
}


// =====================================================
// GET GOODS RECEIPT BY ID
// =====================================================

export async function getGoodsReceiptById(
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

        const receiptId =
            Number(req.params.id);

        if (!Number.isInteger(receiptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid goods receipt ID"
            });
        }

        const db = getDatabase();

        // =================================================
        // RECEIPT HEADER
        // =================================================

        const headerRequest = db.request()
            .input(
                "id",
                receiptId
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const headerResult =
            await headerRequest.query(`
                SELECT
                    gr.Id,
                    gr.CompanyId,
                    gr.BranchId,
                    b.Name AS BranchName,
                    gr.WarehouseId,
                    w.Name AS WarehouseName,
                    gr.SupplierId,
                    s.Name AS SupplierName,
                    gr.PurchaseOrderId,
                    po.PurchaseOrderNumber,
                    gr.ReceiptNumber,
                    gr.ReceiptDate,
                    gr.Status,
                    gr.Notes,
                    gr.CreatedBy,
                    u.FullName AS CreatedByName,
                    gr.CreatedAt
                FROM GoodsReceipts gr

                LEFT JOIN Branches b
                    ON b.Id = gr.BranchId

                LEFT JOIN Warehouses w
                    ON w.Id = gr.WarehouseId

                LEFT JOIN Suppliers s
                    ON s.Id = gr.SupplierId

                LEFT JOIN PurchaseOrders po
                    ON po.Id = gr.PurchaseOrderId

                LEFT JOIN Users u
                    ON u.Id = gr.CreatedBy

                WHERE
                    gr.Id = @id
                    AND gr.CompanyId = @companyId
            `);

        if (headerResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Goods receipt not found"
            });
        }

        // =================================================
        // RECEIPT ITEMS
        // =================================================

        const itemsRequest = db.request()
            .input(
                "goodsReceiptId",
                receiptId
            );

        const itemsResult =
            await itemsRequest.query(`
                SELECT
                    gri.Id,
                    gri.GoodsReceiptId,
                    gri.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,
                    gri.BatchId,
                    pb.BatchNumber,
                    gri.LocationId,
                    wl.Name AS LocationName,
                    gri.ReceivedQuantity,
                    gri.UnitCost,
                    gri.ExpiryDate,
                    gri.Notes
                FROM GoodsReceiptItems gri

                INNER JOIN Products p
                    ON p.Id = gri.ProductId

                LEFT JOIN ProductBatches pb
                    ON pb.Id = gri.BatchId

                LEFT JOIN WarehouseLocations wl
                    ON wl.Id = gri.LocationId

                WHERE
                    gri.GoodsReceiptId =
                    @goodsReceiptId

                ORDER BY gri.Id
            `);

        return res.status(200).json({
            success: true,
            data: {
                receipt: headerResult.recordset[0],
                items: itemsResult.recordset
            }
        });

    } catch (error) {

        console.error(
            "Get goods receipt by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get goods receipt"
        });
    }
}

// =====================================================
// APPROVE GOODS RECEIPT
// =====================================================

export async function approveGoodsReceipt(
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

        const receiptId =
            Number(req.params.id);

        if (!Number.isInteger(receiptId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid goods receipt ID"
            });
        }

        const db = getDatabase();

        const request = db.request()
            .input(
                "id",
                receiptId
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const result = await request.query(`
            SELECT
                Id,
                Status
            FROM GoodsReceipts
            WHERE
                Id = @id
                AND CompanyId = @companyId
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Goods receipt not found"
            });
        }

        const receipt =
            result.recordset[0];

        // =============================================
        // ONLY RECEIVED RECEIPTS CAN BE APPROVED
        // =============================================

        if (receipt.Status !== "RECEIVED") {
            return res.status(400).json({
                success: false,
                message:
                    `Goods receipt cannot be approved because its status is ${receipt.Status}`
            });
        }

        // =============================================
        // CHECK RECEIPT HAS ITEMS
        // =============================================

        const itemRequest = db.request()
            .input(
                "goodsReceiptId",
                receiptId
            );

        const itemResult =
            await itemRequest.query(`
                SELECT COUNT(*) AS ItemCount
                FROM GoodsReceiptItems
                WHERE GoodsReceiptId = @goodsReceiptId
            `);

        const itemCount =
            Number(itemResult.recordset[0].ItemCount);

        if (itemCount === 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot approve goods receipt without items"
            });
        }

        // =============================================
        // APPROVE
        // =============================================

        const updateRequest = db.request()
            .input(
                "id",
                receiptId
            );

        await updateRequest.query(`
            UPDATE GoodsReceipts
            SET
                Status = 'APPROVED'
            WHERE
                Id = @id
        `);

        return res.status(200).json({
            success: true,
            message:
                "Goods receipt approved successfully",
            goodsReceiptId: receiptId
        });

    } catch (error) {

        console.error(
            "Approve goods receipt error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to approve goods receipt"
        });
    }
}

// =====================================================
// CANCEL GOODS RECEIPT
// =====================================================

export async function cancelGoodsReceipt(
    req: AuthRequest,
    res: Response
) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const receiptId = Number(req.params.id);

    if (!Number.isInteger(receiptId)) {
        return res.status(400).json({
            success: false,
            message: "Invalid goods receipt ID"
        });
    }

    const db = getDatabase();
    const transaction = new sql.Transaction(db);

    try {
        await transaction.begin();

        // =================================================
        // 1. GET RECEIPT
        // =================================================

        const receiptRequest =
            new sql.Request(transaction);

        receiptRequest
            .input("id", receiptId)
            .input("companyId", req.user.companyId);

        const receiptResult =
            await receiptRequest.query(`
                SELECT
                    Id,
                    CompanyId,
                    PurchaseOrderId,
                    WarehouseId,
                    Status,
                    ReceiptNumber
                FROM GoodsReceipts
                WHERE
                    Id = @id
                    AND CompanyId = @companyId
            `);

        if (receiptResult.recordset.length === 0) {
            await transaction.rollback();

            return res.status(404).json({
                success: false,
                message: "Goods receipt not found"
            });
        }

        const receipt =
            receiptResult.recordset[0];

        // =================================================
        // 2. CHECK STATUS
        // =================================================

        if (
            receipt.Status !== "RECEIVED" &&
            receipt.Status !== "APPROVED"
        ) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message:
                    `Goods receipt cannot be cancelled because its status is ${receipt.Status}`
            });
        }

        // =================================================
        // 3. GET RECEIPT ITEMS
        // =================================================

        const itemsRequest =
            new sql.Request(transaction);

        itemsRequest.input(
            "goodsReceiptId",
            receiptId
        );

        const itemsResult =
            await itemsRequest.query(`
                SELECT
                    Id,
                    ProductId,
                    BatchId,
                    LocationId,
                    ReceivedQuantity,
                    UnitCost
                FROM GoodsReceiptItems
                WHERE GoodsReceiptId = @goodsReceiptId
            `);

        if (itemsResult.recordset.length === 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Cannot cancel a goods receipt without items"
            });
        }

        // =================================================
        // 4. PROCESS EACH ITEM
        // =================================================

        for (const item of itemsResult.recordset) {

            const productId =
                Number(item.ProductId);

            const quantity =
                Number(item.ReceivedQuantity);

            const batchId =
                item.BatchId !== null
                    ? Number(item.BatchId)
                    : null;

            const locationId =
                item.LocationId !== null
                    ? Number(item.LocationId)
                    : null;

            // =================================================
            // FIND STOCK
            // =================================================

            const stockRequest =
                new sql.Request(transaction);

            stockRequest
                .input(
                    "companyId",
                    req.user.companyId
                )
                .input(
                    "productId",
                    productId
                )
                .input(
                    "warehouseId",
                    receipt.WarehouseId
                )
                .input(
                    "locationId",
                    locationId
                )
                .input(
                    "batchId",
                    batchId
                );

            const stockResult =
                await stockRequest.query(`
                    SELECT
                        Id,
                        Quantity
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

            if (stockResult.recordset.length === 0) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Stock record not found for product ${productId}`
                });
            }

            const stock =
                stockResult.recordset[0];

            const currentQuantity =
                Number(stock.Quantity);

            // =================================================
            // PROTECT AGAINST NEGATIVE STOCK
            // =================================================

            if (currentQuantity < quantity) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message:
                        `Cannot cancel receipt. Current stock for product ${productId} is ${currentQuantity}, but ${quantity} needs to be reversed`
                });
            }

            const newQuantity =
                currentQuantity - quantity;

            // =================================================
            // UPDATE STOCK
            // =================================================

            const updateStockRequest =
                new sql.Request(transaction);

            updateStockRequest
                .input(
                    "id",
                    stock.Id
                )
                .input(
                    "quantity",
                    newQuantity
                );

            await updateStockRequest.query(`
                UPDATE Stock
                SET
                    Quantity = @quantity,
                    UpdatedAt = GETDATE()
                WHERE Id = @id
            `);

            // =================================================
            // CREATE REVERSE STOCK TRANSACTION
            // =================================================

            const transactionRequest =
                new sql.Request(transaction);

            transactionRequest
                .input(
                    "companyId",
                    req.user.companyId
                )
                .input(
                    "productId",
                    productId
                )
                .input(
                    "warehouseId",
                    receipt.WarehouseId
                )
                .input(
                    "locationId",
                    locationId
                )
                .input(
                    "batchId",
                    batchId
                )
                .input(
                    "transactionType",
                    "RECEIPT_REVERSAL"
                )
                .input(
                    "referenceType",
                    "GOODS_RECEIPT_CANCEL"
                )
                .input(
                    "referenceId",
                    receiptId
                )
                .input(
                    "quantity",
                    -quantity
                )
                .input(
                    "unitCost",
                    Number(item.UnitCost)
                )
                .input(
                    "createdBy",
                    req.user.userId
                )
                .input(
                    "notes",
                    `Cancellation of goods receipt ${receipt.ReceiptNumber}`
                );

            await transactionRequest.query(`
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

            // =================================================
            // RESTORE PO RECEIVED QUANTITY
            // =================================================

            if (receipt.PurchaseOrderId) {

                const poItemRequest =
                    new sql.Request(transaction);

                poItemRequest
                    .input(
                        "purchaseOrderId",
                        receipt.PurchaseOrderId
                    )
                    .input(
                        "productId",
                        productId
                    );

                const poItemResult =
                    await poItemRequest.query(`
                        SELECT TOP 1
                            Id,
                            ReceivedQuantity
                        FROM PurchaseOrderItems
                        WHERE
                            PurchaseOrderId =
                                @purchaseOrderId
                            AND ProductId =
                                @productId
                        ORDER BY Id
                    `);

                if (
                    poItemResult.recordset.length > 0
                ) {
                    const poItem =
                        poItemResult.recordset[0];

                    const currentReceived =
                        Number(
                            poItem.ReceivedQuantity
                        );

                    const newReceived =
                        Math.max(
                            0,
                            currentReceived - quantity
                        );

                    const updatePOItemRequest =
                        new sql.Request(transaction);

                    updatePOItemRequest
                        .input(
                            "id",
                            poItem.Id
                        )
                        .input(
                            "receivedQuantity",
                            newReceived
                        );

                    await updatePOItemRequest.query(`
                        UPDATE PurchaseOrderItems
                        SET
                            ReceivedQuantity =
                                @receivedQuantity
                        WHERE Id = @id
                    `);
                }
            }
        }

        // =================================================
        // 5. UPDATE PO STATUS
        // =================================================

        if (receipt.PurchaseOrderId) {

            const statusRequest =
                new sql.Request(transaction);

            statusRequest.input(
                "purchaseOrderId",
                receipt.PurchaseOrderId
            );

            const statusResult =
                await statusRequest.query(`
                    SELECT
                        SUM(OrderedQuantity)
                            AS TotalOrdered,
                        SUM(ReceivedQuantity)
                            AS TotalReceived
                    FROM PurchaseOrderItems
                    WHERE PurchaseOrderId =
                        @purchaseOrderId
                `);

            const totals =
                statusResult.recordset[0];

            const totalOrdered =
                Number(totals.TotalOrdered || 0);

            const totalReceived =
                Number(totals.TotalReceived || 0);

            let poStatus = "APPROVED";

            if (
                totalReceived > 0 &&
                totalReceived < totalOrdered
            ) {
                poStatus = "PARTIALLY_RECEIVED";
            }

            if (
                totalOrdered > 0 &&
                totalReceived >= totalOrdered
            ) {
                poStatus = "FULLY_RECEIVED";
            }

            const updatePORequest =
                new sql.Request(transaction);

            updatePORequest
                .input(
                    "purchaseOrderId",
                    receipt.PurchaseOrderId
                )
                .input(
                    "status",
                    poStatus
                );

            await updatePORequest.query(`
                UPDATE PurchaseOrders
                SET
                    Status = @status,
                    UpdatedAt = GETDATE()
                WHERE Id = @purchaseOrderId
            `);
        }

        // =================================================
        // 6. CANCEL RECEIPT
        // =================================================

        const cancelRequest =
            new sql.Request(transaction);

        cancelRequest.input(
            "id",
            receiptId
        );

        await cancelRequest.query(`
            UPDATE GoodsReceipts
            SET
                Status = 'CANCELLED'
            WHERE Id = @id
        `);

        // =================================================
        // 7. COMMIT
        // =================================================

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message:
                "Goods receipt cancelled successfully",
            goodsReceiptId: receiptId
        });

    } catch (error) {

        try {
            await transaction.rollback();
        } catch {}

        console.error(
            "Cancel goods receipt error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to cancel goods receipt"
        });
    }
}