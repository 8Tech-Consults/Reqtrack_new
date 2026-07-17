import { describe, expect, test } from "bun:test";
import requireAnyPermission from "../helpers/requireAnyPermission.js";

describe("requireAnyPermission", () => {
  test("rejects anonymous requests", () => {
    expect(() => requireAnyPermission({}, ["can_manage_jobs"])).toThrow(
      "Please sign in to continue.",
    );
  });

  test("rejects authenticated users without a required permission", () => {
    const context = { req: { user: { permissions: [] } } };
    expect(() => requireAnyPermission(context, ["can_manage_jobs"])).toThrow(
      "You do not have permission to perform this action.",
    );
  });

  test("accepts any matching permission from an array-shaped role", () => {
    const context = {
      req: {
        user: {
          permissions: [{ can_view_jobs: true }, { can_manage_jobs: true }],
        },
      },
    };
    expect(() =>
      requireAnyPermission(context, ["can_create_jobs", "can_manage_jobs"]),
    ).not.toThrow();
  });

  test("accepts matching permissions from a flat role object", () => {
    const context = {
      req: { user: { permissions: { can_manage_news: true } } },
    };
    expect(() =>
      requireAnyPermission(context, ["can_manage_news"]),
    ).not.toThrow();
  });
});
