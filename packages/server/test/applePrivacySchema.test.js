import { describe, expect, test } from "bun:test";
import { Kind, parse } from "graphql";
import pwdTypeDefs from "../schema/pwd/typeDefs.js";
import userTypeDefs from "../schema/user/typeDefs.js";

const inputFieldType = (source, inputName, fieldName) => {
  const document = parse(source);
  const input = document.definitions.find(
    (definition) =>
      definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION &&
      definition.name.value === inputName,
  );
  const field = input?.fields?.find((item) => item.name.value === fieldName);
  return field?.type;
};

const isRequired = (source, inputName, fieldName) =>
  inputFieldType(source, inputName, fieldName)?.kind === Kind.NON_NULL_TYPE;

describe("Apple privacy registration contract", () => {
  test("requires a password but not phone or district for accounts", () => {
    expect(isRequired(userTypeDefs, "RegisterInput", "password")).toBe(true);
    expect(isRequired(userTypeDefs, "RegisterInput", "phone_number")).toBe(false);
    expect(isRequired(userTypeDefs, "RegisterInput", "district")).toBe(false);
  });

  test("keeps demographic PWD profile fields optional", () => {
    expect(isRequired(pwdTypeDefs, "PwdInput", "gender")).toBe(false);
    expect(isRequired(pwdTypeDefs, "PwdInput", "district_of_origin")).toBe(false);
    expect(isRequired(pwdTypeDefs, "PwdInput", "phone_number")).toBe(false);
    expect(isRequired(pwdTypeDefs, "PwdInput", "date_of_birth")).toBe(false);
  });
});
