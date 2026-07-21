import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { prisma } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import memberRoutes from "./routes/members.js";
import configRoutes from "./routes/config.js";
import yearRoutes from "./routes/years.js";
import paymentRoutes from "./routes/payments.js";
import exceptionalRoutes from "./routes/exceptional.js";
import tontineRoutes from "./routes/tontines.js";
import notificationRoutes from "./routes/notifications.js";
import importRoutes from "./routes/import.js";
import exportRoutes from "./routes/export.js";
import platformRoutes from "./routes/platform.js";
import vehicleRoutes from "./routes/vehicles.js";
import publicRoutes from "./routes/public.js";
import activityLogRoutes from "./routes/activityLog.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;

//
// MIDDLEWARE
//

// SÉCURITÉ: Trust proxy pour rate limiters derrière reverse proxy (Render, Heroku, etc.)
app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3002",
      "http://localhost:19006",
      "https://web-bx1a.onrender.com",
      "https://assocmanager-web.onrender.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Association-Code",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

//
// ROUTES
//

app.get("/api", (req, res) => {
  res.json({
    message: "AssocManager API V2",
    status: "OK",
    version: "2.0.0",
    database: "PostgreSQL",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

//
// ROUTES V1 (Association)
//

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/config", configRoutes);
app.use("/api/years", yearRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/exceptional", exceptionalRoutes);
app.use("/api/tontines", tontineRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/import", importRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/activity-log", activityLogRoutes);

//
// ROUTES V2 (Platform)
//

app.use("/api/platform", platformRoutes);

//
// ROUTES PUBLIQUES (sans auth)
//

app.use("/api/public", publicRoutes);

//
// ERROR HANDLER
//

// Middleware pour gérer les erreurs de parsing JSON (body-parser)
app.use((err, req, res, next) => {
  // Erreur de parsing JSON
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  next(err);
});

// Middleware d'erreur global - ne jamais exposer la stack trace
app.use((err, req, res, next) => {
  console.error("Error:", err);

  res.status(err.status || 500).json({
    error: err.message || "Erreur serveur"
  });
});

//
// SHUTDOWN
//

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

//
// START SERVER
//

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 AssocManager API démarrée sur le port ${PORT}`);
  console.log(`📍 http://0.0.0.0:${PORT}/api`);
  console.log(`🗄️ Base de données: PostgreSQL`);
});

export default app;