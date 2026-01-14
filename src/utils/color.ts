import chalkBase from "chalk";

type ColorConfig = {
  readonly enabled?: boolean;
};

function resolveColorOverride(enabled?: boolean): "force" | "disable" | "auto" {
  if (enabled === false) return "disable";
  if (enabled === true) return "force";
  if (process.env.FORCE_COLOR === "0") return "disable";
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return "disable";
  }
  return "auto";
}

const autoLevel = chalkBase.level;

const chalk = chalkBase;
export { chalk };

export function configureColor(config: ColorConfig = {}): void {
  const mode = resolveColorOverride(config.enabled);
  if (mode === "disable") {
    chalkBase.level = 0;
    return;
  }
  if (mode === "force") {
    chalkBase.level = 3;
    return;
  }
  chalkBase.level = autoLevel;
}
