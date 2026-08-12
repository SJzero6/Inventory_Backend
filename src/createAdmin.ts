import dotenv from "dotenv";
import { connectDatabase, getDatabase } from "./config/database";
import { hashPassword } from "./utils/password";

dotenv.config();

async function createAdmin() {
    try {
        await connectDatabase();

        const db = getDatabase();

        const username = "admin";
        const password = "Admin@12345";
        const fullName = "System Administrator";

        // Check company
        const companyResult = await db.request().query(`
            SELECT TOP 1 Id
            FROM Companies
            WHERE Code = 'DEMO'
              AND IsActive = 1
        `);

        if (companyResult.recordset.length === 0) {
            throw new Error("Demo company was not found.");
        }

        const companyId = companyResult.recordset[0].Id;

        // Check branch
        const branchResult = await db
            .request()
            .input("companyId", companyId)
            .query(`
                SELECT TOP 1 Id
                FROM Branches
                WHERE CompanyId = @companyId
                  AND Code = 'MAIN'
                  AND IsActive = 1
            `);

        if (branchResult.recordset.length === 0) {
            throw new Error("Main branch was not found.");
        }

        const branchId = branchResult.recordset[0].Id;

        // Check existing user
        const existingUser = await db
            .request()
            .input("companyId", companyId)
            .input("username", username)
            .query(`
                SELECT Id
                FROM Users
                WHERE CompanyId = @companyId
                  AND Username = @username
            `);

        if (existingUser.recordset.length > 0) {
            console.log("Admin user already exists.");
            return;
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const userResult = await db
            .request()
            .input("companyId", companyId)
            .input("branchId", branchId)
            .input("username", username)
            .input("passwordHash", passwordHash)
            .input("fullName", fullName)
            .query(`
                INSERT INTO Users
                (
                    CompanyId,
                    BranchId,
                    Username,
                    PasswordHash,
                    FullName,
                    IsActive
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @companyId,
                    @branchId,
                    @username,
                    @passwordHash,
                    @fullName,
                    1
                )
            `);

        const userId = userResult.recordset[0].Id;

        // Find Super Admin role
        const roleResult = await db.request().query(`
            SELECT TOP 1 Id
            FROM Roles
            WHERE Name = 'Super Admin'
              AND IsActive = 1
        `);

        if (roleResult.recordset.length === 0) {
            throw new Error("Super Admin role was not found.");
        }

        const roleId = roleResult.recordset[0].Id;

        // Assign Super Admin role
        await db
            .request()
            .input("userId", userId)
            .input("roleId", roleId)
            .query(`
                INSERT INTO UserRoles
                (
                    UserId,
                    RoleId
                )
                VALUES
                (
                    @userId,
                    @roleId
                )
            `);

        console.log("");
        console.log("======================================");
        console.log("Super Admin created successfully");
        console.log("======================================");
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`User ID: ${userId}`);
        console.log("======================================");
        console.log("");

    } catch (error) {
        console.error("Failed to create admin:", error);
    } finally {
        process.exit(0);
    }
}

createAdmin();