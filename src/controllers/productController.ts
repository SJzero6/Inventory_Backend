import { Request, Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getProducts(
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

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .query(`
                SELECT
                    p.Id,
                    p.CompanyId,
                    p.CategoryId,
                    c.Name AS CategoryName,
                    p.BrandId,
                    b.Name AS BrandName,
                    p.UnitId,
                    u.Name AS UnitName,
                    p.ProductCode,
                    p.Barcode,
                    p.Name,
                    p.Description,
                    p.PurchasePrice,
                    p.SellingPrice,
                    p.TaxPercent,
                    p.MinimumStock,
                    p.HasBatch,
                    p.HasExpiry,
                    p.IsActive,
                    p.CreatedAt,
                    p.UpdatedAt
                FROM Products p

                LEFT JOIN Categories c
                    ON c.Id = p.CategoryId

                LEFT JOIN Brands b
                    ON b.Id = p.BrandId

                LEFT JOIN Units u
                    ON u.Id = p.UnitId

                WHERE p.CompanyId = @companyId

                ORDER BY p.Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {

        console.error("Get products error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve products"
        });
    }
}

export async function getProductById(
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

        const productId = Number(req.params.id);

        if (!Number.isInteger(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productId", productId)
            .query(`
                SELECT
                    p.Id,
                    p.CompanyId,
                    p.CategoryId,
                    c.Name AS CategoryName,
                    p.BrandId,
                    b.Name AS BrandName,
                    p.UnitId,
                    u.Name AS UnitName,
                    p.ProductCode,
                    p.Barcode,
                    p.Name,
                    p.Description,
                    p.PurchasePrice,
                    p.SellingPrice,
                    p.TaxPercent,
                    p.MinimumStock,
                    p.HasBatch,
                    p.HasExpiry,
                    p.IsActive,
                    p.CreatedAt,
                    p.UpdatedAt
                FROM Products p

                LEFT JOIN Categories c
                    ON c.Id = p.CategoryId

                LEFT JOIN Brands b
                    ON b.Id = p.BrandId

                LEFT JOIN Units u
                    ON u.Id = p.UnitId

                WHERE
                    p.Id = @productId
                    AND p.CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {

        console.error("Get product error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve product"
        });
    }
}

export async function createProduct(
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
            categoryId,
            brandId,
            unitId,
            productCode,
            barcode,
            name,
            description,
            purchasePrice,
            sellingPrice,
            taxPercent,
            minimumStock,
            hasBatch,
            hasExpiry
        } = req.body;

        if (!productCode || !name || !unitId) {
            return res.status(400).json({
                success: false,
                message: "Product code, name and unit are required"
            });
        }

        const db = getDatabase();

        // Validate Category, Brand and Unit
const masterData = await db
    .request()
    .input("companyId", req.user.companyId)
    .input("categoryId", categoryId ?? null)
    .input("brandId", brandId ?? null)
    .input("unitId", unitId)
    .query(`
        SELECT
            (SELECT COUNT(*)
             FROM Categories
             WHERE Id = @categoryId
               AND CompanyId = @companyId
               AND IsActive = 1) AS CategoryExists,

            (SELECT COUNT(*)
             FROM Brands
             WHERE Id = @brandId
               AND CompanyId = @companyId
               AND IsActive = 1) AS BrandExists,

            (SELECT COUNT(*)
             FROM Units
             WHERE Id = @unitId
               AND CompanyId = @companyId
               AND IsActive = 1) AS UnitExists
    `);

const master = masterData.recordset[0];

if (categoryId && master.CategoryExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive category"
    });
}

if (brandId && master.BrandExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive brand"
    });
}

if (master.UnitExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive unit"
    });
}

        // Check duplicate product code
        const existingCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productCode", productCode)
            .query(`
                SELECT Id
                FROM Products
                WHERE
                    CompanyId = @companyId
                    AND ProductCode = @productCode
            `);

        if (existingCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Product code already exists"
            });
        }

        // Check duplicate barcode
        if (barcode) {

            const existingBarcode = await db
                .request()
                .input("companyId", req.user.companyId)
                .input("barcode", barcode)
                .query(`
                    SELECT Id
                    FROM Products
                    WHERE
                        CompanyId = @companyId
                        AND Barcode = @barcode
                `);

            if (existingBarcode.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Barcode already exists"
                });
            }
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("categoryId", categoryId ?? null)
            .input("brandId", brandId ?? null)
            .input("unitId", unitId)
            .input("productCode", productCode)
            .input("barcode", barcode ?? null)
            .input("name", name)
            .input("description", description ?? null)
            .input("purchasePrice", purchasePrice ?? 0)
            .input("sellingPrice", sellingPrice ?? 0)
            .input("taxPercent", taxPercent ?? 0)
            .input("minimumStock", minimumStock ?? 0)
            .input("hasBatch", hasBatch ?? false)
            .input("hasExpiry", hasExpiry ?? false)
            .query(`
                INSERT INTO Products
                (
                    CompanyId,
                    CategoryId,
                    BrandId,
                    UnitId,
                    ProductCode,
                    Barcode,
                    Name,
                    Description,
                    PurchasePrice,
                    SellingPrice,
                    TaxPercent,
                    MinimumStock,
                    HasBatch,
                    HasExpiry,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @categoryId,
                    @brandId,
                    @unitId,
                    @productCode,
                    @barcode,
                    @name,
                    @description,
                    @purchasePrice,
                    @sellingPrice,
                    @taxPercent,
                    @minimumStock,
                    @hasBatch,
                    @hasExpiry,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
            productId: result.recordset[0].Id
        });

    } catch (error) {

        console.error("Create product error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create product"
        });
    }
}

export async function updateProduct(
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

        const productId = Number(req.params.id);

        if (!Number.isInteger(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const {
            categoryId,
            brandId,
            unitId,
            productCode,
            barcode,
            name,
            description,
            purchasePrice,
            sellingPrice,
            taxPercent,
            minimumStock,
            hasBatch,
            hasExpiry,
            isActive
        } = req.body;

        if (!productCode || !name || !unitId) {
            return res.status(400).json({
                success: false,
                message: "Product code, name and unit are required"
            });
        }

        const db = getDatabase();

        // Validate Category, Brand and Unit
const masterData = await db
    .request()
    .input("companyId", req.user.companyId)
    .input("categoryId", categoryId ?? null)
    .input("brandId", brandId ?? null)
    .input("unitId", unitId)
    .query(`
        SELECT
            (SELECT COUNT(*)
             FROM Categories
             WHERE Id = @categoryId
               AND CompanyId = @companyId
               AND IsActive = 1) AS CategoryExists,

            (SELECT COUNT(*)
             FROM Brands
             WHERE Id = @brandId
               AND CompanyId = @companyId
               AND IsActive = 1) AS BrandExists,

            (SELECT COUNT(*)
             FROM Units
             WHERE Id = @unitId
               AND CompanyId = @companyId
               AND IsActive = 1) AS UnitExists
    `);

const master = masterData.recordset[0];

if (categoryId && master.CategoryExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive category"
    });
}

if (brandId && master.BrandExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive brand"
    });
}

if (master.UnitExists === 0) {
    return res.status(400).json({
        success: false,
        message: "Invalid or inactive unit"
    });
}

        // Check product belongs to user's company
        const existingProduct = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productId", productId)
            .query(`
                SELECT Id
                FROM Products
                WHERE
                    Id = @productId
                    AND CompanyId = @companyId
            `);

        if (existingProduct.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check duplicate product code
        const duplicateCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productCode", productCode)
            .input("productId", productId)
            .query(`
                SELECT Id
                FROM Products
                WHERE
                    CompanyId = @companyId
                    AND ProductCode = @productCode
                    AND Id <> @productId
            `);

        if (duplicateCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Product code already exists"
            });
        }

        // Check duplicate barcode
        if (barcode) {

            const duplicateBarcode = await db
                .request()
                .input("companyId", req.user.companyId)
                .input("barcode", barcode)
                .input("productId", productId)
                .query(`
                    SELECT Id
                    FROM Products
                    WHERE
                        CompanyId = @companyId
                        AND Barcode = @barcode
                        AND Id <> @productId
                `);

            if (duplicateBarcode.recordset.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Barcode already exists"
                });
            }
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productId", productId)
            .input("categoryId", categoryId ?? null)
            .input("brandId", brandId ?? null)
            .input("unitId", unitId)
            .input("productCode", productCode)
            .input("barcode", barcode ?? null)
            .input("name", name)
            .input("description", description ?? null)
            .input("purchasePrice", purchasePrice ?? 0)
            .input("sellingPrice", sellingPrice ?? 0)
            .input("taxPercent", taxPercent ?? 0)
            .input("minimumStock", minimumStock ?? 0)
            .input("hasBatch", hasBatch ?? false)
            .input("hasExpiry", hasExpiry ?? false)
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Products
                SET
                    CategoryId = @categoryId,
                    BrandId = @brandId,
                    UnitId = @unitId,
                    ProductCode = @productCode,
                    Barcode = @barcode,
                    Name = @name,
                    Description = @description,
                    PurchasePrice = @purchasePrice,
                    SellingPrice = @sellingPrice,
                    TaxPercent = @taxPercent,
                    MinimumStock = @minimumStock,
                    HasBatch = @hasBatch,
                    HasExpiry = @hasExpiry,
                    IsActive = @isActive,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @productId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Product updated successfully"
        });

    } catch (error) {

        console.error("Update product error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update product"
        });
    }
}

export async function deactivateProduct(
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

        const productId = Number(req.params.id);

        if (!Number.isInteger(productId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("productId", productId)
            .query(`
                UPDATE Products
                SET
                    IsActive = 0,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @productId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Product deactivated successfully"
        });

    } catch (error) {

        console.error("Deactivate product error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate product"
        });
    }
}