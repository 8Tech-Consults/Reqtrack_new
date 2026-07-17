import { describe, expect, test } from "bun:test";
import {
  hasUsableBearerToken,
  isPublicGraphqlOperation,
} from "../utils/graphqlPublicAccess.js";

describe("isPublicGraphqlOperation", () => {
  test("allows an exact public query field", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "Jobs",
        query: "query Jobs { jobs(limit: 10) { records { id } } }",
      }),
    ).toBe(true);
  });

  test("does not trust a public-looking operation name", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "Jobs",
        query: "mutation Jobs { deleteJob(id: 1) { success } }",
      }),
    ).toBe(false);
  });

  test("rejects a mixed public and protected operation", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "Mixed",
        query: "query Mixed { jobs { records { id } } users { id } }",
      }),
    ).toBe(false);
  });

  test("allows only the selected operation in a multi-operation document", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "NewsItems",
        query:
          "query NewsItems { newsItems { records { id } } } mutation Remove { deleteNews(id: 1) { success } }",
      }),
    ).toBe(true);
  });

  test("allows the additive public paginated news feed", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "NewsFeed",
        query: "query NewsFeed { newsFeed(limit: 12) { items { id } pageInfo { totalCount } } }",
      }),
    ).toBe(true);
  });

  test("allows public product and service-provider browsing", () => {
    expect(
      isPublicGraphqlOperation({
        operationName: "Products",
        query: "query Products { products(limit: 20) { id name } }",
      }),
    ).toBe(true);

    expect(
      isPublicGraphqlOperation({
        operationName: "ServiceProviders",
        query:
          "query ServiceProviders { serviceProviders(limit: 20) { records { id name } } }",
      }),
    ).toBe(true);
  });

  test("rejects malformed documents", () => {
    expect(
      isPublicGraphqlOperation({ operationName: "Jobs", query: "not graphql" }),
    ).toBe(false);
  });
});

describe("hasUsableBearerToken", () => {
  test("accepts a real bearer token", () => {
    expect(hasUsableBearerToken("Bearer abc.def.ghi")).toBe(true);
  });

  test("rejects missing placeholder tokens emitted by anonymous clients", () => {
    expect(hasUsableBearerToken("Bearer undefined")).toBe(false);
    expect(hasUsableBearerToken("Bearer null")).toBe(false);
    expect(hasUsableBearerToken("Bearer ")).toBe(false);
  });
});
