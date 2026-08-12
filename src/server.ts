import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { connectDatabase } from "./config/database";
import healthRoutes from "./routes/healthRoutes";
import authRoutes from "./routes/authRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import productRoutes from "./routes/productRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import brandRoutes from "./routes/brandRoutes";
import unitRoutes from "./routes/unitRoutes";
import supplierRoutes from "./routes/supplierRoutes";
import warehouseRoutes from "./routes/warehouseRoutes";
import warehouseLocationRoutes from "./routes/warehouseLocationRoutes";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/warehouse-locations", warehouseLocationRoutes);


const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
    try {

        await connectDatabase();

        app.listen(PORT, () => {
            console.log(`Inventory API running on port ${PORT}`);
            console.log(`http://localhost:${PORT}`);
        });

    } catch (error) {

        console.error(
            "Server could not start because database connection failed."
        );

        process.exit(1);
    }
}

startServer();