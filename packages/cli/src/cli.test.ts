import { describe, it, expect } from "vitest";
import { cliVersion } from "./cli.js";

describe("cli stub", () => {
  it("returns a version string containing identra-cli", () => {
    const v = cliVersion();
    expect(v).toContain("identra-cli");
    expect(typeof v).toBe("string");
  });
});
