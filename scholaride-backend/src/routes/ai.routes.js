const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");

// Standard chat completion
router.post("/chat", aiController.chat);

// Streaming chat completion
router.post("/chat/stream", aiController.streamChat);

module.exports = router;
