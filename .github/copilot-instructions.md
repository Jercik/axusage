# Project Context

This project requires Node.js >=22.14.0 (see `engines` in package.json). Node.js v22.18+ and v24+ run TypeScript files natively without `--experimental-strip-types` - type stripping is enabled by default.

When reviewing code that runs `.ts` files directly with `node`, this is correct and intentional. Do not suggest adding experimental flags or using external runners like `tsx` or `ts-node`.

# Code Style

See AGENTS.md for comprehensive coding standards. Key points:

- Use pnpm as package manager (`pnpm exec` for local binaries, not `pnpx`)
- Prefer named exports over default exports
- Use discriminated unions to prevent impossible states
- Use `interface extends` over type intersections (`&`) for performance
- Use `import type` for type-only imports
