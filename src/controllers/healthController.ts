import { Request, Response } from "express";
import { getDatabase } from "../config/database";

export async function healthCheck(
    req: Request,
    res: Response
) {
    try {
        const db = getDatabase();

        const result = await db.request().query(`
            SELECT
                DB_NAME() AS databaseName,
                GETDATE() AS serverTime
        `);

        res.json({
            success: true,
            message: "Inventory API is working",
            database: result.recordset[0]
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
}