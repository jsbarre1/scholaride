const Anthropic = require("@anthropic-ai/sdk");

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "⚠️ WARNING: ANTHROPIC_API_KEY is not defined in the environment variables.",
  );
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

module.exports = anthropic;
