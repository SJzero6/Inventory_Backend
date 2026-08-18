import { Request, Response } from "express";
import sql from "mssql";
import { AuthRequest } from "../middleware/authMiddleware";
import { getDatabase } from "../config/database";



// =====================================================
// CREATE PURCHASE ORDER
// =====================================================

export async function createPurchaseOrder(
    req: AuthRequest,
    res: Response
) {
    const transaction = new sql.Transaction();

    try {
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
            purchaseOrderNumber,
            orderDate,
            discountAmount = 0,
            notes,
            items
        } = req.body;

        if (
            !branchId ||
            !warehouseId ||
            !supplierId ||
            !purchaseOrderNumber ||
            !orderDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Branch, warehouse, supplier, PO number and order date are required"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one purchase item is required"
            });
        }

        const db = getDatabase();

        const transaction = new sql.Transaction(db);

        await transaction.begin();

        // -------------------------------------------------
        // Check duplicate PO number
        // -------------------------------------------------

        const duplicateRequest = new sql.Request(transaction);

        duplicateRequest
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "purchaseOrderNumber",
                purchaseOrderNumber
            );

        const duplicateResult =
            await duplicateRequest.query(`
                SELECT Id
                FROM PurchaseOrders
                WHERE CompanyId = @companyId
                AND PurchaseOrderNumber = @purchaseOrderNumber
            `);

        if (duplicateResult.recordset.length > 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "Purchase order number already exists"
            });
        }

        // -------------------------------------------------
        // Calculate totals
        // -------------------------------------------------

        let subTotal = 0;
        let taxAmount = 0;

        for (const item of items) {

            const quantity = Number(
                item.orderedQuantity
            );

            const unitCost = Number(
                item.unitCost
            );

            const itemDiscount = Number(
                item.discountAmount || 0
            );

            const itemTax = Number(
                item.taxAmount || 0
            );

            if (
                !item.productId ||
                quantity <= 0 ||
                unitCost < 0
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Invalid purchase item"
                });
            }

            const itemSubtotal =
                quantity * unitCost;

            subTotal +=
                itemSubtotal - itemDiscount;

            taxAmount += itemTax;
        }

        const totalDiscount =
            Number(discountAmount || 0);

        const totalAmount =
            subTotal +
            taxAmount -
            totalDiscount;

        if (totalAmount < 0) {
            await transaction.rollback();

            return res.status(400).json({
                success: false,
                message: "Total amount cannot be negative"
            });
        }

        // -------------------------------------------------
        // Insert Purchase Order
        // -------------------------------------------------

        const orderRequest =
            new sql.Request(transaction);

        orderRequest
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
                "purchaseOrderNumber",
                purchaseOrderNumber
            )
            .input(
                "orderDate",
                new Date(orderDate)
            )
            .input(
                "status",
                "DRAFT"
            )
            .input(
                "subTotal",
                subTotal
            )
            .input(
                "taxAmount",
                taxAmount
            )
            .input(
                "discountAmount",
                totalDiscount
            )
            .input(
                "totalAmount",
                totalAmount
            )
            .input(
                "notes",
                notes || null
            )
            .input(
                "createdBy",
                req.user.userId
            );

        const orderResult =
            await orderRequest.query(`
                INSERT INTO PurchaseOrders
                (
                    CompanyId,
                    BranchId,
                    WarehouseId,
                    SupplierId,
                    PurchaseOrderNumber,
                    OrderDate,
                    Status,
                    SubTotal,
                    TaxAmount,
                    DiscountAmount,
                    TotalAmount,
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
                    @purchaseOrderNumber,
                    @orderDate,
                    @status,
                    @subTotal,
                    @taxAmount,
                    @discountAmount,
                    @totalAmount,
                    @notes,
                    @createdBy,
                    GETDATE()
                )
            `);

        const purchaseOrderId =
            orderResult.recordset[0].Id;

        // -------------------------------------------------
        // Insert Purchase Items
        // -------------------------------------------------

        for (const item of items) {

            const quantity =
                Number(item.orderedQuantity);

            const unitCost =
                Number(item.unitCost);

            const itemDiscount =
                Number(item.discountAmount || 0);

            const itemTax =
                Number(item.taxAmount || 0);

            const total =
                (quantity * unitCost) -
                itemDiscount +
                itemTax;

            const itemRequest =
                new sql.Request(transaction);

            itemRequest
                .input(
                    "purchaseOrderId",
                    purchaseOrderId
                )
                .input(
                    "productId",
                    Number(item.productId)
                )
                .input(
                    "orderedQuantity",
                    quantity
                )
                .input(
                    "unitCost",
                    unitCost
                )
                .input(
                    "discountAmount",
                    itemDiscount
                )
                .input(
                    "taxAmount",
                    itemTax
                )
                .input(
                    "totalAmount",
                    total
                )
                .input(
                    "receivedQuantity",
                    0
                )
                .input(
                    "notes",
                    item.notes || null
                );

            await itemRequest.query(`
                INSERT INTO PurchaseOrderItems
                (
                    PurchaseOrderId,
                    ProductId,
                    OrderedQuantity,
                    UnitCost,
                    DiscountAmount,
                    TaxAmount,
                    TotalAmount,
                    ReceivedQuantity,
                    Notes
                )
                VALUES
                (
                    @purchaseOrderId,
                    @productId,
                    @orderedQuantity,
                    @unitCost,
                    @discountAmount,
                    @taxAmount,
                    @totalAmount,
                    @receivedQuantity,
                    @notes
                )
            `);
        }

        await transaction.commit();

        return res.status(201).json({
            success: true,
            message: "Purchase order created successfully",
            purchaseOrderId
        });

    } catch (error) {

        try {
            if (transaction) {
                await transaction.rollback();
            }
        } catch {}

        console.error(
            "Create purchase order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create purchase order"
        });
    }
}


// =====================================================
// GET PURCHASE ORDERS
// =====================================================

export async function getPurchaseOrders(
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

        const request = new sql.Request();

        request.input(
            "companyId",
            req.user.companyId
        );

        const result =
            await request.query(`
                SELECT
                    po.Id,
                    po.CompanyId,
                    po.BranchId,
                    b.Name AS BranchName,

                    po.WarehouseId,
                    w.Name AS WarehouseName,

                    po.SupplierId,
                    s.Name AS SupplierName,

                    po.PurchaseOrderNumber,
                    po.OrderDate,
                    po.Status,

                    po.SubTotal,
                    po.TaxAmount,
                    po.DiscountAmount,
                    po.TotalAmount,

                    po.Notes,
                    po.CreatedBy,
                    u.FullName AS CreatedByName,

                    po.CreatedAt,
                    po.UpdatedAt

                FROM PurchaseOrders po

                INNER JOIN Branches b
                    ON b.Id = po.BranchId

                INNER JOIN Warehouses w
                    ON w.Id = po.WarehouseId

                INNER JOIN Suppliers s
                    ON s.Id = po.SupplierId

                LEFT JOIN Users u
                    ON u.Id = po.CreatedBy

                WHERE po.CompanyId = @companyId

                ORDER BY
                    po.CreatedAt DESC,
                    po.Id DESC
            `);

        return res.status(200).json({
            success: true,
            count: result.recordset.length,
            purchaseOrders: result.recordset
        });

    } catch (error) {

        console.error(
            "Get purchase orders error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get purchase orders"
        });
    }
}


// =====================================================
// GET PURCHASE ORDER BY ID
// =====================================================

export async function getPurchaseOrderById(
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

        const id =
            Number(req.params.id);

        if (!Number.isInteger(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid purchase order ID"
            });
        }

        const request =
            new sql.Request();

        request
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "id",
                id
            );

        const orderResult =
            await request.query(`
                SELECT
                    po.Id,
                    po.CompanyId,
                    po.BranchId,
                    b.Name AS BranchName,

                    po.WarehouseId,
                    w.Name AS WarehouseName,

                    po.SupplierId,
                    s.Name AS SupplierName,

                    po.PurchaseOrderNumber,
                    po.OrderDate,
                    po.Status,

                    po.SubTotal,
                    po.TaxAmount,
                    po.DiscountAmount,
                    po.TotalAmount,

                    po.Notes,
                    po.CreatedBy,
                    u.FullName AS CreatedByName,

                    po.CreatedAt,
                    po.UpdatedAt

                FROM PurchaseOrders po

                INNER JOIN Branches b
                    ON b.Id = po.BranchId

                INNER JOIN Warehouses w
                    ON w.Id = po.WarehouseId

                INNER JOIN Suppliers s
                    ON s.Id = po.SupplierId

                LEFT JOIN Users u
                    ON u.Id = po.CreatedBy

                WHERE
                    po.Id = @id
                    AND po.CompanyId = @companyId
            `);

        if (orderResult.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Purchase order not found"
            });
        }

        const itemsRequest =
            new sql.Request();

        itemsRequest
            .input(
                "purchaseOrderId",
                id
            );

        const itemsResult =
            await itemsRequest.query(`
                SELECT
                    poi.Id,
                    poi.PurchaseOrderId,

                    poi.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,

                    poi.OrderedQuantity,
                    poi.UnitCost,
                    poi.DiscountAmount,
                    poi.TaxAmount,
                    poi.TotalAmount,
                    poi.ReceivedQuantity,

                    poi.Notes

                FROM PurchaseOrderItems poi

                INNER JOIN Products p
                    ON p.Id = poi.ProductId

                WHERE
                    poi.PurchaseOrderId =
                    @purchaseOrderId

                ORDER BY poi.Id
            `);

        return res.status(200).json({
            success: true,
            purchaseOrder: {
                ...orderResult.recordset[0],
                items: itemsResult.recordset
            }
        });

    } catch (error) {

        console.error(
            "Get purchase order error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get purchase order"
        });
    }
}