import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const dbConfig: sql.config = {
    server: process.env.DB_SERVER || "",
    database: process.env.DB_DATABASE || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT) || 1433,

    options: {
        encrypt: false,
        trustServerCertificate: true
    },

    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool: sql.ConnectionPool;

export async function connectDatabase(): Promise<sql.ConnectionPool> {
    try {
        pool = await sql.connect(dbConfig);

        console.log("SQL Server connected successfully");
        console.log(`Database: ${dbConfig.database}`);

        return pool;
    } catch (error) {
        console.error("SQL Server connection failed:");
        console.error(error);

        throw error;
    }
}

export function getDatabase(): sql.ConnectionPool {
    if (!pool) {
        throw new Error("Database is not connected");
    }

    return pool;
}

export { sql };