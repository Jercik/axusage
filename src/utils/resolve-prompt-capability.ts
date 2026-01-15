export function resolvePromptCapability(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}
