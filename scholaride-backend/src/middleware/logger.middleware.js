module.exports = (req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  // Log incoming request
  console.log(`\n[${new Date().toISOString()}] ➡️ ${method} ${url}`);

  try {
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      if (Object.keys(req.body).length > 0) {
        const logBody = { ...req.body };
        if (logBody.apiKey) logBody.apiKey = "***REDACTED***";
        console.log("Body:", JSON.stringify(logBody, null, 2));
      }
    }
  } catch (err) {
    console.error("Logger request-body logging error:", err.message);
  }

  // Capture the original send to log the response body
  const oldSend = res.send;
  res.send = function (data) {
    try {
      const duration = Date.now() - start;
      console.log(
        `[${new Date().toISOString()}] ⬅️ ${method} ${url} ${res.statusCode} (${duration}ms)`,
      );

      // Only log response body if it's JSON and not too huge
      if (typeof data === "string" && data.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(data);
          console.log("Response:", JSON.stringify(parsed, null, 2));
        } catch (e) {
          // Not JSON or parse error, skip logging body
        }
      }
    } catch (err) {
      console.error("Logger response logging error:", err.message);
    }

    return oldSend.apply(res, arguments);
  };

  next();
};
