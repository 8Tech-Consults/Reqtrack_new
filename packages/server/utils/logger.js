const serializeError = (error) => ({
  name: error?.name || "Error",
  message: error?.message || String(error || "Unknown error"),
  stack: error?.stack,
  code: error?.extensions?.code || error?.code,
  path: error?.path,
});

const write = (level, event, details = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    app: "pwd-observatory-server",
    app_version: process.env.APP_VERSION || process.env.npm_package_version || "unknown",
    ...details,
  };

  const output = JSON.stringify(payload);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
};

export const requestLogContext = (req) => ({
  request_id: req?.requestId,
  endpoint: req?.originalUrl || req?.url,
  method: req?.method,
  user_id: req?.user?.id || null,
  user_agent: req?.headers?.["user-agent"] || null,
  client_app_version: req?.headers?.["x-app-version"] || null,
  ip: req?.ip || req?.socket?.remoteAddress || null,
});

export const logInfo = (event, details) => write("info", event, details);
export const logWarning = (event, details) => write("warn", event, details);
export const logError = (event, error, details = {}) =>
  write("error", event, { ...details, error: serializeError(error) });
