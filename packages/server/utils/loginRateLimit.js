import { createHash } from "node:crypto";
import { ipKeyGenerator } from "express-rate-limit";

const LOGIN_OPERATION_PATTERN = /\blogin\s*\(/i;

export const isLoginOperation = (req) => {
  const body = req.body ?? {};
  const operationName = body.operationName || req.query?.operationName;
  const query =
    typeof body.query === "string"
      ? body.query
      : typeof req.query?.query === "string"
        ? req.query.query
        : "";

  return operationName === "Login" || LOGIN_OPERATION_PATTERN.test(query);
};

const loginIdentity = (req) => {
  const variables = req.body?.variables ?? {};
  const value = variables.email ?? variables.username ?? "unknown-login";
  return String(value).trim().toLowerCase() || "unknown-login";
};

export const loginRateLimitKey = (req) => {
  const address = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const ipKey = ipKeyGenerator(address, 56);
  const identityHash = createHash("sha256")
    .update(loginIdentity(req))
    .digest("hex");

  return `${ipKey}:${identityHash}`;
};

const parseGraphqlResponse = (body) => {
  if (body && typeof body === "object" && !Buffer.isBuffer(body)) return body;

  if (typeof body === "string" || Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString());
    } catch {
      return null;
    }
  }

  return null;
};

export const loginResponseWasSuccessful = (body) => {
  const payload = parseGraphqlResponse(body);
  return Boolean(
    payload &&
      !payload.errors?.length &&
      payload.data?.login?.token
  );
};

export const captureLoginResult = (req, res, next) => {
  if (!isLoginOperation(req)) return next();

  const originalSend = res.send.bind(res);
  res.send = (body) => {
    res.locals.loginWasSuccessful = loginResponseWasSuccessful(body);
    return originalSend(body);
  };

  next();
};
