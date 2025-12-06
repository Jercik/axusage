# Project Context

This project requires Node.js >=22.14.0 (see `engines` in package.json). Type stripping is built in for Node.js 22.18+ and 24+; 22.14.0–22.17.x still need `--experimental-strip-types` when running `.ts` directly.

Use native execution for development scripts and ad-hoc utilities. Node.js only removes types (no type checking or transformation of enums, namespaces, or legacy decorators), so the published CLI continues to ship compiled JS (`bin/agent-usage` points to `dist/cli.js`).

When reviewing `.ts` files run directly with `node`, assume the runtime is 22.18+ and do not suggest adding experimental flags or external runners (`tsx`, `ts-node`). If a change must support 22.14.0–22.17.x, call out the flag requirement explicitly.

# Code Style

See AGENTS.md for comprehensive coding standards. Key points:

- Use pnpm as package manager (`pnpm exec` for local binaries, not `pnpx`)
- Prefer named exports over default exports
- Use discriminated unions to prevent impossible states
- Use `interface extends` over type intersections (`&`) for performance
- Use `import type` for type-only imports
