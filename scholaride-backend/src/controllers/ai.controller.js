const anthropic = require("../config/anthropic");

const TUTOR_SYSTEM_PROMPT = `You are a helpful academic tutor. Your goal is to guide students toward understanding by asking Socratic questions and providing conceptual explanations. 

CRITICAL RULES:
1. NEVER provide direct answers to assignments or questions.
2. NEVER generate complete code snippets or full solutions.
3. If a student asks for code, explain the logic/pseudocode behind it and encourage them to try writing it themselves.
4. Use a supportive, encouraging tone.
5. If the student is stuck, offer a small hint or ask a question that leads them to the next step.
6. Always prioritize teaching the "why" over the "how".
7. Be extremely concise. Keep your responses short and focused on a single next step or concept to avoid overwhelming the student.`;

/**
 * Standard non-streaming chat completion
 */
exports.chat = async (req, res) => {
  try {
    const { messages, model = "claude-haiku-4-5" } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: TUTOR_SYSTEM_PROMPT,
      messages,
    });

    res.json(message);
  } catch (error) {
    console.error("Anthropic API Error:", error);
    res.status(500).json({
      error: "Failed to get completion from AI",
      details: error.message,
    });
  }
};

/**
 * Streaming chat completion
 */
exports.streamChat = async (req, res) => {
  try {
    const { messages, model = "claude-haiku-4-5" } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log(`[AI Stream] Starting stream for model: ${model}`);
    const stream = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: TUTOR_SYSTEM_PROMPT,
      messages,
      stream: true,
    });

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    console.log("[AI Stream] Stream completed successfully");
    res.end();
  } catch (error) {
    console.error("Anthropic Streaming Error:", error);
    // If we haven't sent headers yet, we can send a 500
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      // If streaming already started, we just end it with an error message
      res.write(
        `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`,
      );
      res.end();
    }
  }
};
