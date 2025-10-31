import { describe, it, expect } from "vitest";
import { classifyUsageRate } from "./classify-usage-rate.js";

describe("classify-usage-rate", () => {
  it("classifies thresholds correctly", () => {
    expect(classifyUsageRate(1)).toBe("green");
    expect(classifyUsageRate(1.0001)).toBe("yellow");
    expect(classifyUsageRate(1.5)).toBe("yellow");
    expect(classifyUsageRate(1.5001)).toBe("red");
  });
});
