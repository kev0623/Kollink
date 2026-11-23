import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => {
    delete process.env.KOLLINK_TEST_VAR;
  });

  it("returns the value when set", () => {
    process.env.KOLLINK_TEST_VAR = "hello";
    expect(requireEnv("KOLLINK_TEST_VAR")).toBe("hello");
  });

  it("throws with the variable name when missing", () => {
    expect(() => requireEnv("KOLLINK_TEST_VAR")).toThrow("Missing env KOLLINK_TEST_VAR");
  });

  it("treats empty string as missing", () => {
    process.env.KOLLINK_TEST_VAR = "";
    expect(() => requireEnv("KOLLINK_TEST_VAR")).toThrow("Missing env KOLLINK_TEST_VAR");
  });
});
