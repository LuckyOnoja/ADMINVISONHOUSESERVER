import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { loginAdmin, seedDefaultAdmin } from "./controllers/auth.controller";
import { getOperatingDays, updateOperatingDay } from "./controllers/operatingDays.controller";
import {
  getAvailableSlots,
  initiateBooking,
  verifyBooking,
  getAdminBookings
} from "./controllers/bookings.controller";
import { authenticateAdmin } from "./middlewares/auth.middleware";

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({ origin: "*" })); // Allow frontend calls from anywhere during dev
app.use(express.json());

// Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Admin Authentication Route
app.post("/api/auth/login", loginAdmin);

// Operating Days (Client-facing fetches)
app.get("/api/operating-days", getOperatingDays);

// Booking Flow (Client-facing)
app.get("/api/bookings/available-slots", getAvailableSlots);
app.post("/api/bookings/initiate", initiateBooking);
app.post("/api/bookings/verify", verifyBooking);

// Protected Admin Routes
app.post("/api/operating-days", authenticateAdmin as any, updateOperatingDay);
app.get("/api/admin/bookings", authenticateAdmin as any, getAdminBookings);

// Base Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Startup Server
app.listen(PORT, async () => {
  console.log(`==================================================`);
  console.log(`🚀 Creative Studio Server running on port ${PORT}`);
  console.log(`==================================================`);

  // Seed default admin if table is empty
  await seedDefaultAdmin();
});
