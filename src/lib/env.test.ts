import { afterEach, describe, expect, it } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  afterEach(() => {
    delete process.env.POLLEN_TEST_VAR;
  });

  it("returns the value when set", () => {
    process.env.POLLEN_TEST_VAR = "hello";
    expect(requireEnv("POLLEN_TEST_VAR")).toBe("hello");
  });

  it("throws with the variable name when missing", () => {
    expect(() => requireEnv("POLLEN_TEST_VAR")).toThrow("Missing env POLLEN_TEST_VAR");
  });

  it("treats empty string as missing", () => {
    process.env.POLLEN_TEST_VAR = "";
    expect(() => requireEnv("POLLEN_TEST_VAR")).toThrow("Missing env POLLEN_TEST_VAR");
  });
});
