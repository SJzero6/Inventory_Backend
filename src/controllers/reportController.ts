import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import { getDatabase } from "../config/database";


// =====================================================
// STOCK REPORT
// =====================================================

export async function getStockReport(
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

        const {
            warehouseId,
            locationId,
            productId,
            batchId,
            includeZeroStock
        } = req.query;

        const request = db.request()
            .input(
                "companyId",
                req.user.companyId
            );

        let conditions = `
            s.CompanyId = @companyId
        `;

        // Warehouse filter
        if (warehouseId) {
            request.input(
                "warehouseId",
                Number(warehouseId)
            );

            conditions += `
                AND s.WarehouseId = @warehouseId
            `;
        }

        // Location filter
        if (locationId) {
            request.input(
                "locationId",
                Number(locationId)
            );

            conditions += `
                AND s.LocationId = @locationId
            `;
        }

        // Product filter
        if (productId) {
            request.input(
                "productId",
                Number(productId)
            );

            conditions += `
                AND s.ProductId = @productId
            `;
        }

        // Batch filter
        if (batchId) {
            request.input(
                "batchId",
                Number(batchId)
            );

            conditions += `
                AND s.BatchId = @batchId
            `;
        }

        // By default only show stock > 0
        if (
            includeZeroStock !== "true"
        ) {
            conditions += `
                AND s.Quantity > 0
            `;
        }

        const result = await request.query(`
            SELECT
                s.Id,
                s.CompanyId,

                s.ProductId,
                p.ProductCode,
                p.Barcode,
                p.Name AS ProductName,

                s.WarehouseId,
                w.Name AS WarehouseName,

                s.LocationId,
                wl.Name AS LocationName,

                s.BatchId,
                pb.BatchNumber,
                pb.ManufactureDate,
                pb.ExpiryDate,

                s.Quantity,
                s.AverageCost,

                (
                    s.Quantity *
                    s.AverageCost
                ) AS StockValue,

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
                ${conditions}

            ORDER BY
                p.Name,
                w.Name,
                pb.BatchNumber
        `);

        // =================================================
        // SUMMARY
        // =================================================

        let totalQuantity = 0;
        let totalStockValue = 0;

        for (const row of result.recordset) {
            totalQuantity +=
                Number(row.Quantity || 0);

            totalStockValue +=
                Number(row.StockValue || 0);
        }

        return res.status(200).json({
            success: true,
            summary: {
                totalItems:
                    result.recordset.length,

                totalQuantity,

                totalStockValue
            },
            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get stock report error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get stock report"
        });
    }
}

// =====================================================
// PURCHASE REPORT
// =====================================================

export async function getPurchaseReport(
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

        const {
            supplierId,
            warehouseId,
            branchId,
            status,
            fromDate,
            toDate
        } = req.query;

        const request = db.request()
            .input(
                "companyId",
                req.user.companyId
            );

        let conditions = `
            po.CompanyId = @companyId
        `;

        if (supplierId) {
            request.input(
                "supplierId",
                Number(supplierId)
            );

            conditions += `
                AND po.SupplierId = @supplierId
            `;
        }

        if (warehouseId) {
            request.input(
                "warehouseId",
                Number(warehouseId)
            );

            conditions += `
                AND po.WarehouseId = @warehouseId
            `;
        }

        if (branchId) {
            request.input(
                "branchId",
                Number(branchId)
            );

            conditions += `
                AND po.BranchId = @branchId
            `;
        }

        if (status) {
            request.input(
                "status",
                String(status)
            );

            conditions += `
                AND po.Status = @status
            `;
        }

        if (fromDate) {
            request.input(
                "fromDate",
                String(fromDate)
            );

            conditions += `
                AND po.OrderDate >= @fromDate
            `;
        }

        if (toDate) {
            request.input(
                "toDate",
                String(toDate)
            );

            conditions += `
                AND po.OrderDate <= @toDate
            `;
        }

        const result = await request.query(`
            SELECT
                po.Id,
                po.CompanyId,

                po.PurchaseOrderNumber,
                po.OrderDate,
                po.Status,

                po.BranchId,
                b.Name AS BranchName,

                po.WarehouseId,
                w.Name AS WarehouseName,

                po.SupplierId,
                s.Name AS SupplierName,
                s.SupplierCode,

                po.SubTotal,
                po.TaxAmount,
                po.DiscountAmount,
                po.TotalAmount,

                po.Notes,

                po.CreatedBy,
                u.FullName AS CreatedByName,

                po.CreatedAt,
                po.UpdatedAt,

                (
                    SELECT COUNT(*)
                    FROM PurchaseOrderItems poi
                    WHERE poi.PurchaseOrderId = po.Id
                ) AS ItemCount,

                (
                    SELECT
                        ISNULL(
                            SUM(poi.OrderedQuantity),
                            0
                        )
                    FROM PurchaseOrderItems poi
                    WHERE poi.PurchaseOrderId = po.Id
                ) AS TotalOrderedQuantity,

                (
                    SELECT
                        ISNULL(
                            SUM(poi.ReceivedQuantity),
                            0
                        )
                    FROM PurchaseOrderItems poi
                    WHERE poi.PurchaseOrderId = po.Id
                ) AS TotalReceivedQuantity

            FROM PurchaseOrders po

            LEFT JOIN Branches b
                ON b.Id = po.BranchId

            LEFT JOIN Warehouses w
                ON w.Id = po.WarehouseId

            LEFT JOIN Suppliers s
                ON s.Id = po.SupplierId

            LEFT JOIN Users u
                ON u.Id = po.CreatedBy

            WHERE
                ${conditions}

            ORDER BY
                po.OrderDate DESC,
                po.Id DESC
        `);

        // =================================================
        // SUMMARY
        // =================================================

        let totalOrders = 0;
        let totalAmount = 0;
        let totalOrderedQuantity = 0;
        let totalReceivedQuantity = 0;

        for (const row of result.recordset) {

            totalOrders++;

            totalAmount +=
                Number(row.TotalAmount || 0);

            totalOrderedQuantity +=
                Number(
                    row.TotalOrderedQuantity || 0
                );

            totalReceivedQuantity +=
                Number(
                    row.TotalReceivedQuantity || 0
                );
        }

        return res.status(200).json({
            success: true,

            summary: {
                totalOrders,
                totalAmount,
                totalOrderedQuantity,
                totalReceivedQuantity
            },

            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get purchase report error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get purchase report"
        });
    }
}


// =====================================================
// STOCK TRANSACTION REPORT
// =====================================================

export async function getTransactionReport(
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

        const {
            productId,
            warehouseId,
            locationId,
            batchId,
            transactionType,
            referenceType,
            fromDate,
            toDate
        } = req.query;

        const request = db.request()
            .input(
                "companyId",
                req.user.companyId
            );

        let conditions = `
            st.CompanyId = @companyId
        `;

        if (productId) {
            request.input(
                "productId",
                Number(productId)
            );

            conditions += `
                AND st.ProductId = @productId
            `;
        }

        if (warehouseId) {
            request.input(
                "warehouseId",
                Number(warehouseId)
            );

            conditions += `
                AND st.WarehouseId = @warehouseId
            `;
        }

        if (locationId) {
            request.input(
                "locationId",
                Number(locationId)
            );

            conditions += `
                AND st.LocationId = @locationId
            `;
        }

        if (batchId) {
            request.input(
                "batchId",
                Number(batchId)
            );

            conditions += `
                AND st.BatchId = @batchId
            `;
        }

        if (transactionType) {
            request.input(
                "transactionType",
                String(transactionType)
            );

            conditions += `
                AND st.TransactionType =
                    @transactionType
            `;
        }

        if (referenceType) {
            request.input(
                "referenceType",
                String(referenceType)
            );

            conditions += `
                AND st.ReferenceType =
                    @referenceType
            `;
        }

        if (fromDate) {
            request.input(
                "fromDate",
                String(fromDate)
            );

            conditions += `
                AND st.TransactionDate >= @fromDate
            `;
        }

        if (toDate) {
            request.input(
                "toDate",
                String(toDate)
            );

            conditions += `
                AND st.TransactionDate <
                    DATEADD(day, 1, @toDate)
            `;
        }

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

                (
                    st.Quantity *
                    st.UnitCost
                ) AS TransactionValue,

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
                ${conditions}

            ORDER BY
                st.TransactionDate DESC,
                st.Id DESC
        `);

        // =================================================
        // SUMMARY
        // =================================================

        let totalTransactions = 0;
        let totalQuantity = 0;
        let totalValue = 0;

        let totalInboundQuantity = 0;
        let totalOutboundQuantity = 0;

        for (const row of result.recordset) {

            const quantity =
                Number(row.Quantity || 0);

            const value =
                Number(row.TransactionValue || 0);

            totalTransactions++;

            totalQuantity += quantity;
            totalValue += value;

            if (quantity > 0) {
                totalInboundQuantity += quantity;
            }

            if (quantity < 0) {
                totalOutboundQuantity +=
                    Math.abs(quantity);
            }
        }

        return res.status(200).json({
            success: true,

            summary: {
                totalTransactions,
                totalQuantity,
                totalValue,
                totalInboundQuantity,
                totalOutboundQuantity
            },

            data: result.recordset
        });

    } catch (error) {

        console.error(
            "Get transaction report error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get transaction report"
        });
    }
}