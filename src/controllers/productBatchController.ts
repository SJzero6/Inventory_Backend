import { Request, Response } from "express";
import sql from "mssql";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// GET PRODUCT BATCHES
// =====================================================

export async function getProductBatches(
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

        const request = db.request();

        request.input(
            "companyId",
            req.user.companyId
        );

        const result = await request.query(`
            SELECT
                pb.Id,
                pb.CompanyId,

                pb.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                pb.BatchNumber,
                pb.ManufactureDate,
                pb.ExpiryDate,
                pb.CostPrice,
                pb.IsActive,
                pb.CreatedAt

            FROM ProductBatches pb

            INNER JOIN Products p
                ON p.Id = pb.ProductId

            WHERE
                pb.CompanyId = @companyId

            ORDER BY
                pb.CreatedAt DESC,
                pb.Id DESC
        `);

        return res.status(200).json({
            success: true,
            count: result.recordset.length,
            batches: result.recordset
        });

    } catch (error) {

        console.error(
            "Get product batches error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get product batches"
        });
    }
}

// =====================================================
// GET PRODUCT BATCH BY ID
// =====================================================

export async function getProductBatchById(
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
                message: "Invalid batch ID"
            });
        }

        const db = getDatabase();

        const request = db.request();

        request
            .input("id", id)
            .input(
                "companyId",
                req.user.companyId
            );

        const result = await request.query(`
            SELECT
                pb.Id,
                pb.CompanyId,

                pb.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                pb.BatchNumber,
                pb.ManufactureDate,
                pb.ExpiryDate,
                pb.CostPrice,
                pb.IsActive,
                pb.CreatedAt

            FROM ProductBatches pb

            INNER JOIN Products p
                ON p.Id = pb.ProductId

            WHERE
                pb.Id = @id
                AND pb.CompanyId = @companyId
        `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product batch not found"
            });
        }

        return res.status(200).json({
            success: true,
            batch: result.recordset[0]
        });

    } catch (error) {

        console.error(
            "Get product batch by ID error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get product batch"
        });
    }
}

// =====================================================
// CREATE PRODUCT BATCH
// =====================================================

export async function createProductBatch(
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
            batchNumber,
            manufactureDate,
            expiryDate,
            costPrice
        } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ProductId is required"
            });
        }

        if (!batchNumber) {
            return res.status(400).json({
                success: false,
                message: "BatchNumber is required"
            });
        }

        if (
            costPrice === undefined ||
            costPrice === null
        ) {
            return res.status(400).json({
                success: false,
                message: "CostPrice is required"
            });
        }

        const db = getDatabase();

        // =================================================
        // CHECK PRODUCT
        // =================================================

        const productRequest =
            db.request();

        productRequest
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const productResult =
            await productRequest.query(`
                SELECT Id
                FROM Products
                WHERE
                    Id = @productId
                    AND CompanyId = @companyId
            `);

        if (
            productResult.recordset.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // =================================================
        // CHECK DUPLICATE BATCH
        // =================================================

        const duplicateRequest =
            db.request();

        duplicateRequest
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "batchNumber",
                batchNumber.trim()
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const duplicateResult =
            await duplicateRequest.query(`
                SELECT Id
                FROM ProductBatches
                WHERE
                    CompanyId = @companyId
                    AND ProductId = @productId
                    AND BatchNumber = @batchNumber
            `);

        if (
            duplicateResult.recordset.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Batch number already exists for this product"
            });
        }

        // =================================================
        // CREATE
        // =================================================

        const request = db.request();

        request
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "batchNumber",
                batchNumber.trim()
            )
            .input(
                "manufactureDate",
                manufactureDate || null
            )
            .input(
                "expiryDate",
                expiryDate || null
            )
            .input(
                "costPrice",
                Number(costPrice)
            );

        const result = await request.query(`
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

        return res.status(201).json({
            success: true,
            message: "Product batch created successfully",
            id: result.recordset[0].Id
        });

    } catch (error) {

        console.error(
            "Create product batch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to create product batch"
        });
    }
}

// =====================================================
// UPDATE PRODUCT BATCH
// =====================================================

export async function updateProductBatch(
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
                message: "Invalid batch ID"
            });
        }

        const {
            productId,
            batchNumber,
            manufactureDate,
            expiryDate,
            costPrice
        } = req.body;

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "ProductId is required"
            });
        }

        if (!batchNumber) {
            return res.status(400).json({
                success: false,
                message: "BatchNumber is required"
            });
        }

        if (
            costPrice === undefined ||
            costPrice === null
        ) {
            return res.status(400).json({
                success: false,
                message: "CostPrice is required"
            });
        }

        const db = getDatabase();

        // =================================================
        // CHECK EXISTING BATCH
        // =================================================

        const existingRequest =
            db.request();

        existingRequest
            .input("id", id)
            .input(
                "companyId",
                req.user.companyId
            );

        const existingResult =
            await existingRequest.query(`
                SELECT
                    Id,
                    ProductId,
                    BatchNumber,
                    IsActive
                FROM ProductBatches
                WHERE
                    Id = @id
                    AND CompanyId = @companyId
            `);

        if (
            existingResult.recordset.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Product batch not found"
            });
        }

        // =================================================
        // CHECK PRODUCT
        // =================================================

        const productRequest =
            db.request();

        productRequest
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const productResult =
            await productRequest.query(`
                SELECT Id
                FROM Products
                WHERE
                    Id = @productId
                    AND CompanyId = @companyId
            `);

        if (
            productResult.recordset.length === 0
        ) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // =================================================
        // CHECK DUPLICATE BATCH
        // =================================================

        const duplicateRequest =
            db.request();

        duplicateRequest
            .input("id", id)
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "batchNumber",
                batchNumber.trim()
            )
            .input(
                "companyId",
                req.user.companyId
            );

        const duplicateResult =
            await duplicateRequest.query(`
                SELECT Id
                FROM ProductBatches
                WHERE
                    CompanyId = @companyId
                    AND ProductId = @productId
                    AND BatchNumber = @batchNumber
                    AND Id <> @id
            `);

        if (
            duplicateResult.recordset.length > 0
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "Batch number already exists for this product"
            });
        }

        // =================================================
        // UPDATE
        // =================================================

        const updateRequest =
            db.request();

        updateRequest
            .input("id", id)
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "productId",
                Number(productId)
            )
            .input(
                "batchNumber",
                batchNumber.trim()
            )
            .input(
                "manufactureDate",
                manufactureDate || null
            )
            .input(
                "expiryDate",
                expiryDate || null
            )
            .input(
                "costPrice",
                Number(costPrice)
            );

        await updateRequest.query(`
            UPDATE ProductBatches
            SET
                ProductId = @productId,
                BatchNumber = @batchNumber,
                ManufactureDate = @manufactureDate,
                ExpiryDate = @expiryDate,
                CostPrice = @costPrice
            WHERE
                Id = @id
                AND CompanyId = @companyId
        `);

        return res.status(200).json({
            success: true,
            message:
                "Product batch updated successfully"
        });

    } catch (error) {

        console.error(
            "Update product batch error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update product batch"
        });
    }
}
// =====================================================
// UPDATE PRODUCT BATCH STATUS
// =====================================================

export async function updateProductBatchStatus(
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
                message: "Invalid batch ID"
            });
        }

        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be true or false"
            });
        }

        const db = getDatabase();

        const request = db.request();

        request
            .input("id", id)
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "isActive",
                isActive
            );

        const result = await request.query(`
            UPDATE ProductBatches
            SET
                IsActive = @isActive
            WHERE
                Id = @id
                AND CompanyId = @companyId
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Product batch not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: isActive
                ? "Product batch activated successfully"
                : "Product batch deactivated successfully"
        });

    } catch (error) {

        console.error(
            "Update product batch status error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to update product batch status"
        });
    }
}

// =====================================================
// GET PRODUCT BATCH EXPIRY REPORT
// =====================================================

export async function getProductBatchExpiry(
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

        const daysParam = req.query.days;

        let days = 30;

        if (daysParam !== undefined) {
            days = Number(daysParam);

            if (
                !Number.isInteger(days) ||
                days < 1 ||
                days > 3650
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "days must be a whole number between 1 and 3650"
                });
            }
        }

        const db = getDatabase();

        const request = db.request();

        request
            .input(
                "companyId",
                req.user.companyId
            )
            .input(
                "days",
                days
            );

        const result = await request.query(`
            SELECT
                pb.Id,

                pb.ProductId,
                p.ProductCode,
                p.Name AS ProductName,

                pb.BatchNumber,

                pb.ManufactureDate,
                pb.ExpiryDate,
                pb.CostPrice,

                pb.IsActive,
                pb.CreatedAt,

                DATEDIFF(
                    DAY,
                    CAST(GETDATE() AS date),
                    pb.ExpiryDate
                ) AS DaysRemaining,

                CASE
                    WHEN pb.ExpiryDate <
                         CAST(GETDATE() AS date)
                        THEN 'EXPIRED'

                    WHEN pb.ExpiryDate <=
                         DATEADD(
                             DAY,
                             @days,
                             CAST(GETDATE() AS date)
                         )
                        THEN 'EXPIRING_SOON'

                    ELSE 'ACTIVE'
                END AS ExpiryStatus

            FROM ProductBatches pb

            INNER JOIN Products p
                ON p.Id = pb.ProductId

            WHERE
                pb.CompanyId = @companyId
                AND pb.ExpiryDate IS NOT NULL
                AND (
                    pb.ExpiryDate <
                        CAST(GETDATE() AS date)

                    OR

                    pb.ExpiryDate <=
                        DATEADD(
                            DAY,
                            @days,
                            CAST(GETDATE() AS date)
                        )
                )

            ORDER BY
                pb.ExpiryDate ASC,
                p.Name ASC,
                pb.BatchNumber ASC
        `);

        const batches = result.recordset;

        const expired = batches.filter(
            (batch: any) =>
                batch.ExpiryStatus === "EXPIRED"
        );

        const expiringSoon = batches.filter(
            (batch: any) =>
                batch.ExpiryStatus === "EXPIRING_SOON"
        );

        return res.status(200).json({
            success: true,

            days,

            summary: {
                expiredCount: expired.length,
                expiringSoonCount:
                    expiringSoon.length,
                totalCount: batches.length
            },

            expired,
            expiringSoon
        });

    } catch (error) {

        console.error(
            "Get product batch expiry error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to get product batch expiry report"
        });
    }
}