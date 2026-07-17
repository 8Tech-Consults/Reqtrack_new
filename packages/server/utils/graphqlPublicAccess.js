import { Kind, parse } from "graphql";

const PUBLIC_ROOT_FIELDS = Object.freeze({
  query: new Set([
    "publicPwdCount",
    "landingPageStats",
    "counsellingCentres",
    "counsellingCentre",
    "disabilities",
    "districts",
    "innovations",
    "innovation",
    "jobs",
    "job",
    "newsItems",
    "newsFeed",
    "newsItem",
    "postCategories",
    "events",
    "event",
    "products",
    "product",
    "serviceProviders",
    "serviceProvider",
  ]),
  mutation: new Set([
    "login",
    "register",
    "requestPasswordResetLink",
    "resetPasswordWithToken",
    "incrementJobView",
    "incrementNewsView",
    "incrementEventView",
    "aiChat", 
  ]),
});

const selectOperation = (document, operationName) => {
  const operations = document.definitions.filter(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  );

  if (operationName) {
    return operations.find(
      (operation) => operation.name?.value === operationName,
    );
  }

  return operations.length === 1 ? operations[0] : null;
};

/**
 * Public access is based on the actual root fields in the selected operation,
 * never on the caller-controlled operation name. Root fragments are rejected
 * so the access decision remains explicit and easy to audit.
 */
export const isPublicGraphqlOperation = ({ query, operationName }) => {
  if (typeof query !== "string" || !query.trim()) return false;

  try {
    const operation = selectOperation(parse(query), operationName);
    if (!operation) return false;

    const allowedFields = PUBLIC_ROOT_FIELDS[operation.operation];
    if (!allowedFields) return false;

    const selections = operation.selectionSet?.selections || [];
    if (!selections.length) return false;

    return selections.every((selection) => {
      if (selection.kind !== Kind.FIELD) return false;
      const fieldName = selection.name.value;
      return fieldName.startsWith("__") || allowedFields.has(fieldName);
    });
  } catch {
    return false;
  }
};

export const hasUsableBearerToken = (authorization) => {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const token = authorization.slice(7).trim();
  return Boolean(token) && !["undefined", "null"].includes(token.toLowerCase());
};

export { PUBLIC_ROOT_FIELDS };
