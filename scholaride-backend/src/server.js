// src/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan("dev")); // Standard logging

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // Serve static files

const logger = require("./middleware/logger.middleware");
app.use(logger); // Detailed logging (after body parsing)

// ===== ROUTES =====
const aiRoutes = require("./routes/ai.routes");

app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Scholaride API",
    version: "1.0.0",
    endpoints: {
      ai: "/api/ai",
    },
  });
});

// ===== ERROR HANDLING =====
// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal server error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app; // For testing
