import { describe, expect, test } from "bun:test";
import {
  isLoginOperation,
  loginRateLimitKey,
  loginResponseWasSuccessful,
} from "./loginRateLimit.js";

const requestFor = (email, ip = "127.0.0.1") => ({
  body: {
    operationName: "Login",
    query: "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token } }",
    variables: { email, password: "secret" },
  },
  query: {},
  ip,
  socket: {},
});

describe("login rate limiting", () => {
  test("recognizes only login operations", () => {
    expect(isLoginOperation(requestFor("one@example.com"))).toBe(true);
    expect(
      isLoginOperation({
        body: { operationName: "Me", query: "query Me { me { id } }" },
        query: {},
      }),
    ).toBe(false);
  });

  test("isolates different users on the same IP", () => {
    expect(loginRateLimitKey(requestFor("one@example.com"))).not.toBe(
      loginRateLimitKey(requestFor("two@example.com")),
    );
  });

  test("normalizes casing and whitespace for the same user", () => {
    expect(loginRateLimitKey(requestFor(" User@Example.com "))).toBe(
      loginRateLimitKey(requestFor("user@example.com")),
    );
  });

  test("isolates the same identity across different IP addresses", () => {
    expect(loginRateLimitKey(requestFor("one@example.com", "127.0.0.1"))).not.toBe(
      loginRateLimitKey(requestFor("one@example.com", "127.0.0.2")),
    );
  });

  test("treats only a token-bearing GraphQL response as successful", () => {
    expect(loginResponseWasSuccessful({ data: { login: { token: "jwt" } } })).toBe(true);
    expect(loginResponseWasSuccessful({ errors: [{ message: "Invalid credentials" }] })).toBe(false);
    expect(loginResponseWasSuccessful('{"data":{"login":{"token":"jwt"}}}')).toBe(true);
  });
});
