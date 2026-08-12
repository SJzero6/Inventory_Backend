import { Response } from "express";
import { getDatabase } from "../config/database";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getSuppliers(
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
                    Id,
                    CompanyId,
                    SupplierCode,
                    Name,
                    ContactPerson,
                    Phone,
                    Email,
                    Address,
                    TaxNumber,
                    PaymentTerms,
                    IsActive,
                    CreatedAt,
                    UpdatedAt
                FROM Suppliers
                WHERE CompanyId = @companyId
                ORDER BY Name
            `);

        return res.json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error("Get suppliers error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve suppliers"
        });
    }
}


export async function getSupplierById(
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

        const supplierId = Number(req.params.id);

        if (!Number.isInteger(supplierId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid supplier ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .query(`
                SELECT
                    Id,
                    CompanyId,
                    SupplierCode,
                    Name,
                    ContactPerson,
                    Phone,
                    Email,
                    Address,
                    TaxNumber,
                    PaymentTerms,
                    IsActive,
                    CreatedAt,
                    UpdatedAt
                FROM Suppliers
                WHERE
                    Id = @supplierId
                    AND CompanyId = @companyId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        return res.json({
            success: true,
            data: result.recordset[0]
        });

    } catch (error) {
        console.error("Get supplier error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve supplier"
        });
    }
}


export async function createSupplier(
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
            supplierCode,
            name,
            contactPerson,
            phone,
            email,
            address,
            taxNumber,
            paymentTerms
        } = req.body;

        if (!supplierCode || !supplierCode.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier code is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required"
            });
        }

        const db = getDatabase();

        // Check duplicate supplier code
        const existingCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierCode", supplierCode.trim())
            .query(`
                SELECT Id
                FROM Suppliers
                WHERE
                    CompanyId = @companyId
                    AND SupplierCode = @supplierCode
            `);

        if (existingCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Supplier code already exists"
            });
        }

        // Check duplicate supplier name
        const existingName = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Suppliers
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
            `);

        if (existingName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Supplier name already exists"
            });
        }

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierCode", supplierCode.trim())
            .input("name", name.trim())
            .input("contactPerson", contactPerson?.trim() || null)
            .input("phone", phone?.trim() || null)
            .input("email", email?.trim() || null)
            .input("address", address?.trim() || null)
            .input("taxNumber", taxNumber?.trim() || null)
            .input("paymentTerms", paymentTerms?.trim() || null)
            .query(`
                INSERT INTO Suppliers
                (
                    CompanyId,
                    SupplierCode,
                    Name,
                    ContactPerson,
                    Phone,
                    Email,
                    Address,
                    TaxNumber,
                    PaymentTerms,
                    IsActive,
                    CreatedAt
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @supplierCode,
                    @name,
                    @contactPerson,
                    @phone,
                    @email,
                    @address,
                    @taxNumber,
                    @paymentTerms,
                    1,
                    GETDATE()
                )
            `);

        return res.status(201).json({
            success: true,
            message: "Supplier created successfully",
            supplierId: result.recordset[0].Id
        });

    } catch (error) {
        console.error("Create supplier error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create supplier"
        });
    }
}


export async function updateSupplier(
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

        const supplierId = Number(req.params.id);

        if (!Number.isInteger(supplierId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid supplier ID"
            });
        }

        const {
            supplierCode,
            name,
            contactPerson,
            phone,
            email,
            address,
            taxNumber,
            paymentTerms,
            isActive
        } = req.body;

        if (!supplierCode || !supplierCode.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier code is required"
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required"
            });
        }

        const db = getDatabase();

        // Check supplier belongs to company
        const existingSupplier = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .query(`
                SELECT Id
                FROM Suppliers
                WHERE
                    Id = @supplierId
                    AND CompanyId = @companyId
            `);

        if (existingSupplier.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        // Check duplicate supplier code
        const duplicateCode = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .input("supplierCode", supplierCode.trim())
            .query(`
                SELECT Id
                FROM Suppliers
                WHERE
                    CompanyId = @companyId
                    AND SupplierCode = @supplierCode
                    AND Id <> @supplierId
            `);

        if (duplicateCode.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Supplier code already exists"
            });
        }

        // Check duplicate supplier name
        const duplicateName = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .input("name", name.trim())
            .query(`
                SELECT Id
                FROM Suppliers
                WHERE
                    CompanyId = @companyId
                    AND Name = @name
                    AND Id <> @supplierId
            `);

        if (duplicateName.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Supplier name already exists"
            });
        }

        await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .input("supplierCode", supplierCode.trim())
            .input("name", name.trim())
            .input("contactPerson", contactPerson?.trim() || null)
            .input("phone", phone?.trim() || null)
            .input("email", email?.trim() || null)
            .input("address", address?.trim() || null)
            .input("taxNumber", taxNumber?.trim() || null)
            .input("paymentTerms", paymentTerms?.trim() || null)
            .input("isActive", isActive ?? true)
            .query(`
                UPDATE Suppliers
                SET
                    SupplierCode = @supplierCode,
                    Name = @name,
                    ContactPerson = @contactPerson,
                    Phone = @phone,
                    Email = @email,
                    Address = @address,
                    TaxNumber = @taxNumber,
                    PaymentTerms = @paymentTerms,
                    IsActive = @isActive,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @supplierId
                    AND CompanyId = @companyId
            `);

        return res.json({
            success: true,
            message: "Supplier updated successfully"
        });

    } catch (error) {
        console.error("Update supplier error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update supplier"
        });
    }
}


export async function deactivateSupplier(
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

        const supplierId = Number(req.params.id);

        if (!Number.isInteger(supplierId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid supplier ID"
            });
        }

        const db = getDatabase();

        const result = await db
            .request()
            .input("companyId", req.user.companyId)
            .input("supplierId", supplierId)
            .query(`
                UPDATE Suppliers
                SET
                    IsActive = 0,
                    UpdatedAt = GETDATE()
                WHERE
                    Id = @supplierId
                    AND CompanyId = @companyId
                    AND IsActive = 1
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found or already inactive"
            });
        }

        return res.json({
            success: true,
            message: "Supplier deactivated successfully"
        });

    } catch (error) {
        console.error("Deactivate supplier error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to deactivate supplier"
        });
    }
}