import { describe, it, expect } from "vitest";
import { sdkVersion } from "./index.js";

describe("sdk stub", () => {
  it("exports a version string", () => {
    expect(sdkVersion()).toBe("0.1.0");
  });
});
