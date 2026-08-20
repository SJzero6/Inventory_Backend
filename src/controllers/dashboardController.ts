import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { getDatabase } from "../config/database";


// =====================================================
// DASHBOARD
// =====================================================

export async function getDashboard(
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

        const companyId = req.user.companyId;

        // =================================================
        // 1. BASIC COUNTS
        // =================================================

        const countRequest = db.request()
            .input("companyId", companyId);

        const countResult = await countRequest.query(`
            SELECT

                (
                    SELECT COUNT(*)
                    FROM Products
                    WHERE CompanyId = @companyId
                ) AS TotalProducts,

                (
                    SELECT COUNT(*)
                    FROM Products
                    WHERE
                        CompanyId = @companyId
                        AND IsActive = 1
                ) AS ActiveProducts,

                (
                    SELECT COUNT(*)
                    FROM Suppliers
                    WHERE
                        CompanyId = @companyId
                        AND IsActive = 1
                ) AS ActiveSuppliers,

                (
                    SELECT COUNT(*)
                    FROM Warehouses
                    WHERE
                        CompanyId = @companyId
                        AND IsActive = 1
                ) AS ActiveWarehouses,

                (
                    SELECT COUNT(*)
                    FROM Branches
                    WHERE
                        CompanyId = @companyId
                        AND IsActive = 1
                ) AS ActiveBranches
        `);

        const counts =
            countResult.recordset[0];


        // =================================================
        // 2. STOCK SUMMARY
        // =================================================

        const stockRequest = db.request()
            .input("companyId", companyId);

        const stockResult = await stockRequest.query(`
            SELECT

                ISNULL(
                    SUM(Quantity),
                    0
                ) AS TotalStockQuantity,

                ISNULL(
                    SUM(
                        Quantity * AverageCost
                    ),
                    0
                ) AS TotalStockValue,

                COUNT(*) AS StockItemCount

            FROM Stock

            WHERE
                CompanyId = @companyId
                AND Quantity > 0
        `);

        const stock =
            stockResult.recordset[0];


        // =================================================
        // 3. LOW STOCK PRODUCTS
        // =================================================

        const lowStockRequest = db.request()
            .input("companyId", companyId);

        const lowStockResult =
            await lowStockRequest.query(`
                SELECT
                    p.Id,
                    p.ProductCode,
                    p.Name AS ProductName,
                    p.MinimumStock,

                    ISNULL(
                        SUM(s.Quantity),
                        0
                    ) AS CurrentStock

                FROM Products p

                LEFT JOIN Stock s
                    ON s.ProductId = p.Id
                    AND s.CompanyId = @companyId

                WHERE
                    p.CompanyId = @companyId
                    AND p.IsActive = 1

                GROUP BY
                    p.Id,
                    p.ProductCode,
                    p.Name,
                    p.MinimumStock

                HAVING
                    ISNULL(
                        SUM(s.Quantity),
                        0
                    ) <= p.MinimumStock

                ORDER BY
                    CurrentStock ASC,
                    p.Name
            `);


        // =================================================
        // 4. PURCHASE ORDER SUMMARY
        // =================================================

        const purchaseRequest = db.request()
            .input("companyId", companyId);

        const purchaseResult =
            await purchaseRequest.query(`
                SELECT

                    COUNT(*) AS TotalPurchaseOrders,

                    SUM(
                        CASE
                            WHEN Status = 'DRAFT'
                            THEN 1
                            ELSE 0
                        END
                    ) AS DraftPurchaseOrders,

                    SUM(
                        CASE
                            WHEN Status = 'APPROVED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS ApprovedPurchaseOrders,

                    SUM(
                        CASE
                            WHEN Status = 'PARTIALLY_RECEIVED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS PartiallyReceivedPurchaseOrders,

                    SUM(
                        CASE
                            WHEN Status = 'FULLY_RECEIVED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS FullyReceivedPurchaseOrders

                FROM PurchaseOrders

                WHERE
                    CompanyId = @companyId
            `);

        const purchases =
            purchaseResult.recordset[0];


        // =================================================
        // 5. GOODS RECEIPT SUMMARY
        // =================================================

        const receivingRequest = db.request()
            .input("companyId", companyId);

        const receivingResult =
            await receivingRequest.query(`
                SELECT

                    COUNT(*) AS TotalGoodsReceipts,

                    SUM(
                        CASE
                            WHEN Status = 'RECEIVED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS ReceivedGoodsReceipts,

                    SUM(
                        CASE
                            WHEN Status = 'APPROVED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS ApprovedGoodsReceipts,

                    SUM(
                        CASE
                            WHEN Status = 'CANCELLED'
                            THEN 1
                            ELSE 0
                        END
                    ) AS CancelledGoodsReceipts

                FROM GoodsReceipts

                WHERE
                    CompanyId = @companyId
            `);

        const receiving =
            receivingResult.recordset[0];


        // =================================================
        // 6. RECENT STOCK TRANSACTIONS
        // =================================================

        const transactionRequest =
            db.request()
                .input("companyId", companyId);

        const transactionResult =
            await transactionRequest.query(`
                SELECT TOP 10

                    st.Id,

                    st.ProductId,
                    p.ProductCode,
                    p.Name AS ProductName,

                    st.WarehouseId,
                    w.Name AS WarehouseName,

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

                LEFT JOIN ProductBatches pb
                    ON pb.Id = st.BatchId

                LEFT JOIN Users u
                    ON u.Id = st.CreatedBy

                WHERE
                    st.CompanyId = @companyId

                ORDER BY
                    st.TransactionDate DESC,
                    st.Id DESC
            `);


        // =================================================
        // 7. RECENT PURCHASE ORDERS
        // =================================================

        const recentPurchaseRequest =
            db.request()
                .input("companyId", companyId);

        const recentPurchaseResult =
            await recentPurchaseRequest.query(`
                SELECT TOP 10

                    po.Id,

                    po.PurchaseOrderNumber,
                    po.OrderDate,
                    po.Status,

                    s.Name AS SupplierName,

                    w.Name AS WarehouseName,

                    po.TotalAmount,

                    po.CreatedAt

                FROM PurchaseOrders po

                LEFT JOIN Suppliers s
                    ON s.Id = po.SupplierId

                LEFT JOIN Warehouses w
                    ON w.Id = po.WarehouseId

                WHERE
                    po.CompanyId = @companyId

                ORDER BY
                    po.CreatedAt DESC,
                    po.Id DESC
            `);


        // =================================================
        // 8. RECENT GOODS RECEIPTS
        // =================================================

        const recentReceiptRequest =
            db.request()
                .input("companyId", companyId);

        const recentReceiptResult =
            await recentReceiptRequest.query(`
                SELECT TOP 10

                    gr.Id,

                    gr.ReceiptNumber,
                    gr.ReceiptDate,
                    gr.Status,

                    s.Name AS SupplierName,

                    w.Name AS WarehouseName,

                    po.PurchaseOrderNumber,

                    gr.CreatedAt

                FROM GoodsReceipts gr

                LEFT JOIN Suppliers s
                    ON s.Id = gr.SupplierId

                LEFT JOIN Warehouses w
                    ON w.Id = gr.WarehouseId

                LEFT JOIN PurchaseOrders po
                    ON po.Id = gr.PurchaseOrderId

                WHERE
                    gr.CompanyId = @companyId

                ORDER BY
                    gr.CreatedAt DESC,
                    gr.Id DESC
            `);


        // =================================================
        // RESPONSE
        // =================================================

        return res.status(200).json({

            success: true,

            summary: {

                products: {
                    total: Number(
                        counts.TotalProducts || 0
                    ),
                    active: Number(
                        counts.ActiveProducts || 0
                    )
                },

                suppliers: Number(
                    counts.ActiveSuppliers || 0
                ),

                warehouses: Number(
                    counts.ActiveWarehouses || 0
                ),

                branches: Number(
                    counts.ActiveBranches || 0
                ),

                stock: {
                    itemCount: Number(
                        stock.StockItemCount || 0
                    ),
                    totalQuantity: Number(
                        stock.TotalStockQuantity || 0
                    ),
                    totalValue: Number(
                        stock.TotalStockValue || 0
                    )
                },

                purchases: {
                    total: Number(
                        purchases.TotalPurchaseOrders || 0
                    ),
                    draft: Number(
                        purchases.DraftPurchaseOrders || 0
                    ),
                    approved: Number(
                        purchases.ApprovedPurchaseOrders || 0
                    ),
                    partiallyReceived: Number(
                        purchases.PartiallyReceivedPurchaseOrders || 0
                    ),
                    fullyReceived: Number(
                        purchases.FullyReceivedPurchaseOrders || 0
                    )
                },

                receiving: {
                    total: Number(
                        receiving.TotalGoodsReceipts || 0
                    ),
                    received: Number(
                        receiving.ReceivedGoodsReceipts || 0
                    ),
                    approved: Number(
                        receiving.ApprovedGoodsReceipts || 0
                    ),
                    cancelled: Number(
                        receiving.CancelledGoodsReceipts || 0
                    )
                }
            },

            lowStockProducts:
                lowStockResult.recordset,

            recentTransactions:
                transactionResult.recordset,

            recentPurchaseOrders:
                recentPurchaseResult.recordset,

            recentGoodsReceipts:
                recentReceiptResult.recordset
        });

    } catch (error) {

        console.error(
            "Get dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get dashboard"
        });
    }
}