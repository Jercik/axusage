import { describe, it, expect, afterEach } from "vitest";
import { chalk, configureColor } from "./color.js";

const originalNoColor = process.env.NO_COLOR;
const originalForceColor = process.env.FORCE_COLOR;

afterEach(() => {
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
  if (originalForceColor === undefined) {
    delete process.env.FORCE_COLOR;
  } else {
    process.env.FORCE_COLOR = originalForceColor;
  }
  configureColor();
});

describe("configureColor", () => {
  it("disables color when explicitly disabled", () => {
    configureColor({ enabled: false });
    expect(chalk.level).toBe(0);
  });

  it("forces color when explicitly enabled", () => {
    configureColor({ enabled: true });
    expect(chalk.level).toBe(3);
  });

  it("disables color when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";
    configureColor();
    expect(chalk.level).toBe(0);
  });

  it("does not treat empty NO_COLOR as a disable signal", () => {
    process.env.NO_COLOR = "";
    configureColor({ enabled: true });
    expect(chalk.level).toBe(3);
  });

  it("disables color when FORCE_COLOR is 0", () => {
    process.env.FORCE_COLOR = "0";
    configureColor({ enabled: true });
    expect(chalk.level).toBe(0);
  });
});
