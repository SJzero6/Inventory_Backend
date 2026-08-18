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
                        FROM PurchaseOrderItems
                        WHERE
                            PurchaseOrderId =
                            @purchaseOrderId
                            AND ProductId =
                            @productId
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