import chalkBase from "chalk";

type ColorConfig = {
  readonly enabled?: boolean;
};

function resolveColorOverride(enabled?: boolean): "force" | "disable" | "auto" {
  if (enabled === false) return "disable";
  if (process.env.NO_COLOR !== undefined) return "disable";
  if (process.env.FORCE_COLOR === "0") return "disable";
  if (enabled === true) return "force";
  return "auto";
}

const autoLevel = chalkBase.level;

export let chalk = chalkBase;

export function configureColor(config: ColorConfig = {}): void {
  const mode = resolveColorOverride(config.enabled);
  if (mode === "disable") {
    chalkBase.level = 0;
    chalk = chalkBase;
    return;
  }
  if (mode === "force") {
    chalkBase.level = 3;
    chalk = chalkBase;
    return;
  }
  chalkBase.level = autoLevel;
  chalk = chalkBase;
}
