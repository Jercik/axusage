# AGENTS.md

To modify rules, edit the source ".md" files and run "sync-rules".

# Rule: Functional Core, Imperative Shell

Separate business logic from side effects by organizing code into a functional core and an imperative shell. The functional core contains pure, testable functions that operate only on provided data, free of I/O operations, database calls, or external state mutations. The imperative shell handles all side effects and orchestrates the functional core to perform business logic.

This separation improves testability, maintainability, and reusability. Core logic can be tested in isolation without mocking external dependencies, and the imperative shell can be modified or swapped without changing business logic.

Example of mixed logic and side effects:

```ts
// Bad: Logic and side effects are mixed
function sendUserExpiryEmail(): void {
  for (const user of db.getUsers()) {
    if (user.subscriptionEndDate > Date.now()) continue;
    if (user.isFreeTrial) continue;
    email.send(user.email, "Your account has expired " + user.name + ".");
  }
}
```

Refactored using functional core and imperative shell:

```ts
// Functional core - pure functions with no side effects
function getExpiredUsers(users: User[], cutoff: Date): User[] {
  return users.filter(
    (user) => user.subscriptionEndDate <= cutoff && !user.isFreeTrial,
  );
}

function generateExpiryEmails(users: User[]): Array<[string, string]> {
  return users.map((user) => [
    user.email,
    `Your account has expired ${user.name}.`,
  ]);
}

// Imperative shell - handles side effects
email.bulkSend(
  generateExpiryEmails(getExpiredUsers(db.getUsers(), Date.now())),
);
```

The functional core functions can now be easily tested with sample data and reused for different purposes without modification.


---

# Rule: Use git-info for Repository Queries

Prefer the `git-info` CLI over manual git/gh command chains for querying git and GitHub repository information. It provides structured JSON output, handles edge cases, and eliminates complex command pipelines.

## Quick Reference

```bash
# Repository state
git-info status [--json]                                      # Complete overview
git-info validate [--json]                                    # Check prerequisites

# Branch information
git-info branch [branch] [--json] [--issue-id <id>]           # Branch details & PR status
git-info default-branch [--json]                              # Discover default branch

# Changes & commits
git-info diff-range [base] [--json] [--head <branch>]         # Analyze commit range (defaults to main..HEAD)

# Worktrees
git-info worktrees [--json] [--issue-id <id>] [--uncommitted-only]  # List all worktrees

# Pull requests
git-info pr [branch] [--json]                                 # PR details & review state
```

## Common Anti-patterns to Replace

```bash
# ❌ Don't chain commands for branch info
git branch --show-current && git rev-parse --abbrev-ref @{u} && git rev-list --count @{u}..HEAD

# ✅ Use git-info
git-info branch --json | jq '.tracking'

# ❌ Don't manually discover default branch
gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' || echo main

# ✅ Use git-info
git-info default-branch

# ❌ Don't parse worktree list manually
git worktree list --porcelain | grep -A1 "worktree" | ...

# ✅ Use git-info
git-info worktrees --json
```

## Common Queries

| Question                            | Command                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| **Repository & Branch State**       |                                                                                  |
| What branch am I on?                | `git-info status --json \| jq -r '.branch.current'`                              |
| Is working tree clean?              | `git-info status --json \| jq '.workingTree.isClean'`                            |
| What's the default branch?          | `git-info default-branch`                                                        |
| Am I on the default branch?         | `git-info status --json \| jq '.branch.isDefault'`                               |
| **Branch Tracking**                 |                                                                                  |
| Does branch exist locally/remotely? | `git-info branch mybranch --json \| jq '.exists'`                                |
| How many commits ahead/behind?      | `git-info branch --json \| jq '.tracking \| {ahead, behind}'`                    |
| Can I fast-forward merge?           | `git-info diff-range main --json \| jq '.fastForwardable'`                       |
| **Pull Requests**                   |                                                                                  |
| Does PR exist for this branch?      | `git-info pr --json \| jq '.exists'`                                             |
| Is PR approved?                     | `git-info pr --json \| jq '.reviews.approved > 0'`                               |
| Are CI checks passing?              | `git-info pr --json \| jq '.checks.failing == 0'`                                |
| **Commits & Changes**               |                                                                                  |
| How many commits since main?        | `git-info diff-range --json \| jq '.commits.count'`                              |
| What files changed?                 | `git-info diff-range --json \| jq '.files'`                                      |
| Are commits conventional?           | `git-info diff-range --json \| jq '[.commits.messages[].isConventional] \| all'` |
| **Worktrees**                       |                                                                                  |
| List all worktrees                  | `git-info worktrees --json`                                                      |
| Find worktree by issue ID           | `git-info worktrees --issue-id NODE-123 --json`                                  |
| Which worktrees have changes?       | `git-info worktrees --uncommitted-only --json`                                   |
| **Pre-flight Checks**               |                                                                                  |
| Is GitHub CLI authenticated?        | `git-info validate --json \| jq '.ghAuthenticated'`                              |
| Can I create a PR?                  | `git-info validate --json \| jq '.errors \| length == 0'`                        |

Use git-info for **reading** repository state. Use regular git commands for **modifying** it.


---

# Rule: Ground Facts with Perplexity

Verify facts with Perplexity before changing code or making claims. Use `mcp__perplexity__lookup` for quick, high‑confidence checks of specifics (API signatures, CLI flags and defaults, config keys, version compatibility). Use `mcp__perplexity__answer` when you’re uncertain, need comparisons or trade‑offs, or when a lookup result contradicts your expectation—ask focused follow‑ups and prefer official docs. If verification stays ambiguous, narrow the claim, mark assumptions explicitly, or ask for clarification; do not proceed on guesswork, especially for task‑critical or security‑sensitive decisions. Perplexity is fast and cheap—err on the side of overuse; a quick lookup costs far less than rework. When you rely on Perplexity, add a short source‑backed note to your status update.


---

# Rule: Use Git Mv

Use `git mv <old> <new>` for renaming or moving tracked files in Git. It stages both deletion and addition in one command, preserves history for `git log --follow`, and is the only reliable method for case-only renames on case-insensitive filesystems (Windows/macOS).

```bash
git mv old-file.js new-file.js              # Simple rename
git mv file.js src/utils/file.js            # Move to directory
git mv readme.md README.md                  # Case-only change
for f in *.test.js; do git mv "$f" tests/; done  # Multiple files (use shell loop)
```


---

# Rule: Child Process Selection

When working with the Node.js `node:child_process` module, follow these guidelines to select the appropriate function for executing commands. The choice depends on factors like synchronicity, access to streams, output handling, shell usage, and error management. Always prefer the function that best matches your needs to avoid unnecessary complexity or performance issues.

## General Guidelines

- **Asynchronous vs. Synchronous Execution**:
  - Use **asynchronous functions** (`spawn`, `exec`, `execFile`) if other tasks should run concurrently while the command executes, or if you need non-blocking I/O.
  - Use **synchronous functions** (`spawnSync`, `execSync`, `execFileSync`) only if you execute one command at a time and can afford to block the event loop (e.g., in scripts or non-server environments).

- **Access to Streams (stdin/stdout/stderr)**:
  - If you need to interact with the child process via streams in real-time (e.g., piping input/output), use asynchronous functions like `spawn()`. Synchronous functions cannot provide live stream access—you get the complete output only after execution finishes.

- **Capturing Output as Strings**:
  - For asynchronous: Use `exec()` or `execFile()` to get `stdout` and `stderr` as strings via callbacks.
  - For synchronous: Use `execSync()` or `execFileSync()` for direct string returns of `stdout`. Use `spawnSync()` for more detailed output objects.

## Asynchronous Functions: Choosing Between `spawn()`, `exec()`, and `execFile()`

- Prefer `exec()` or `execFile()` if:
  - You need simple error handling (all failures reported via the callback's first parameter).
  - You want `stdout` and `stderr` captured as strings automatically (default buffer limit: 200KB).
- Use `spawn()` if:
  - You don't need the callback-based output handling (its signature is simpler).
  - You require direct stream access without buffering limits.
  - Your output may exceed the 200KB default buffer limit of `exec()`/`execFile()`.

Example:

```ts
import { spawn, exec, execFile } from "node:child_process";

// spawn: Direct stream access, no buffering limits, no callback
const child = spawn("find", ["/", "-name", "*.log"]);
child.stdout.on("data", (chunk) => process.stdout.write(chunk));
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

// exec: Shell features, buffered callback with error handling
exec("ls -la | grep .js", (error, stdout, stderr) => {
  if (error) return console.error(error); // All failures here
  console.log(stdout); // Both outputs as strings
});

// execFile: No shell by default, safer with args array
execFile("node", ["--version"], (error, stdout, stderr) => {
  if (error) return console.error(error);
  console.log(stdout);
});
```

## Synchronous Functions: Choosing Between `spawnSync()`, `execSync()`, and `execFileSync()`

- Prefer `execSync()` or `execFileSync()` if:
  - You only need `stdout` as a string return value.
  - Errors should be handled uniformly via exceptions (throws on non-zero exit).
- Use `spawnSync()` if:
  - You need a detailed result object (including `status`, `signal`, `stdout`, `stderr` as Buffers, and `error` property).
  - You want to handle different exit codes programmatically without exceptions.

Example:

```ts
import { execSync, spawnSync } from "node:child_process";

// execSync: Blocking with shell, throws on error
try {
  const output = execSync("git status").toString();
  console.log(output);
} catch (error) {
  console.error(error);
}

// spawnSync: Detailed result object, no live streams
const result = spawnSync("ls", ["-la"]);
if (result.error) console.error(result.error);
if (result.status !== 0) console.error(`Exit code: ${result.status}`);
console.log(result.stdout.toString());
```

## Choosing Between `exec()`/`execSync()` and `execFile()`/`execFileSync()`

- Use `exec()`/`execSync()` if:
  - You need shell features like pipes (`|`), wildcards (`*`), or environment variable expansion.
  - Commands are executed through a shell by default (internally sets `shell: true`).
- Use `execFile()`/`execFileSync()` if:
  - You want direct binary execution without shell interpretation (`shell: false` by default).
  - You need to avoid shell injection risks by passing arguments as an array.
  - You can explicitly set `shell: true` but this defeats the security benefit.

Example:

```ts
import { exec, execFile } from "node:child_process";

// exec: Shell interprets the command, enables pipes and wildcards
exec("ls *.js | head -5", (error, stdout) => {
  if (error) return console.error(error);
  console.log(stdout);
});

// execFile: Direct execution, arguments safely passed as array
const userInput = "file; rm -rf /";
execFile("grep", [userInput, "data.txt"], (error, stdout) => {
  // Safe: userInput treated as literal argument, not shell command
  if (error) return console.error(error);
  console.log(stdout);
});
```

## Key Shell Behavior Summary

| Function                       | Default `shell`     | Notes                                           |
| ------------------------------ | ------------------- | ----------------------------------------------- |
| `spawn()`, `spawnSync()`       | `false`             | Direct execution, no shell unless `shell: true` |
| `exec()`, `execSync()`         | `true` (internally) | Always uses shell, enables pipes/wildcards      |
| `execFile()`, `execFileSync()` | `false`             | Direct execution, safer for user input          |

Consider security implications, especially with user-provided inputs to avoid shell injection.


---

# Rule: Dynamic Imports

Use dynamic `import()` to conditionally load modules at runtime, reducing bundle size and initial load time for features users might never need.

```ts
export async function loadAnalytics() {
  if (process.env.ENABLE_ANALYTICS === "true") {
    const mod = await import("#features/analytics.js");
    return mod.default;
  }
  return null;
}
```


---

# Rule: Import Metadata from package.json

Import name, version, and description directly from package.json to maintain a single source of truth for your package metadata. In Node.js 20.10+ use `with { type: "json" }` syntax (the older `assert` keyword is deprecated); ensure TypeScript's `resolveJsonModule` is enabled in tsconfig.json. This approach eliminates manual version synchronization and reduces maintenance errors when updating package information. Always import from the nearest package.json using relative paths to ensure correct metadata for monorepo packages.

```ts
import packageJson from "./package.json" with { type: "json" };

const program = new Command()
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);
```


---

# Rule: Package.json Imports

Use `package.json` "imports" field with `#` prefixes to create stable internal module paths that replace brittle relative imports like `../../../utils`. The imports field accepts exact paths (`"#db": "./src/db.js"`) and wildcards (`"#utils/*": "./src/utils/*.js"`), and these private subpath imports are only accessible within your package, not from external consumers. Modern Node.js versions support this natively, while recent TypeScript versions provide full editor support including auto-imports and IntelliSense. For TypeScript projects, map to `.js` extensions in package.json since Node.js expects JavaScript at runtime, or use `.ts` with `allowImportingTsExtensions: true` for native TypeScript execution tools like tsx, Bun or latest Node.

```json
{
  "imports": {
    "#config": "./src/config/index.js",
    "#utils/*": "./src/utils/*.js"
  }
}
```


---

# Rule: GitHub PR Review Comments

Use `pr-review-post` to create line-specific review comments, `pr-review-reply` to respond to existing comments, and `pr-comments` to list comment IDs. These tools handle authentication, provide clear errors, and accept messages via argument, stdin, or file.

Post a new review comment on a specific line:

```bash
pr-review-post 123 src/component.tsx 42 "Consider using twMerge here"
pr-review-post 123 src/app.ts 100 -f comment.txt          # Read from file
pr-review-post 123 src/old.ts 50 "Why removed?" --side LEFT  # Comment on deletions
```

For code suggestions GitHub can apply inline, wrap code in triple backticks with `suggestion`:

```bash
pr-review-post 123 src/component.tsx 42 "Use twMerge:
\`\`\`suggestion
className={twMerge('flex gap-3', className)}
\`\`\`"
```

Reply to an existing top-level comment (cannot reply to replies):

```bash
pr-review-reply 456789 "Good catch, I'll fix this"
pr-review-reply 456789 -f reply.txt
pr-review-reply 456789 "Thanks!" --pr 123  # Specify PR number to speed up search
```

List comment IDs for a PR:

```bash
pr-comments 123
pr-comments 123 --json  # For parsing
```


---

# Rule: Any in Generics

When building generic functions, you may need to use any inside the function body.

This is because TypeScript often cannot match your runtime logic to the logic done inside your types.

One example:

```ts
const youSayGoodbyeISayHello = <TInput extends "hello" | "goodbye">(
  input: TInput,
): TInput extends "hello" ? "goodbye" : "hello" => {
  if (input === "goodbye") {
    return "hello"; // Error!
  } else {
    return "goodbye"; // Error!
  }
};
```

On the type level (and the runtime), this function returns `goodbye` when the input is `hello`.

There is no way to make this work concisely in TypeScript.

So using `any` is the most concise solution:

```ts
const youSayGoodbyeISayHello = <TInput extends "hello" | "goodbye">(
  input: TInput,
): TInput extends "hello" ? "goodbye" : "hello" => {
  if (input === "goodbye") {
    return "hello" as any;
  } else {
    return "goodbye" as any;
  }
};
```

Outside of generic functions, use `any` extremely sparingly.


---

# Rule: Default Exports

Unless explicitly required by the framework, do not use default exports.

```ts
// BAD
export default function myFunction() {
  return <div>Hello</div>;
}
```

```ts
// GOOD
export function myFunction() {
  return <div>Hello</div>;
}
```

Default exports create confusion from the importing file.

```ts
// BAD
import myFunction from "./myFunction";
```

```ts
// GOOD
import { myFunction } from "./myFunction";
```

There are certain situations where a framework may require a default export. For instance, Next.js requires a default export for pages.

```tsx
// This is fine, if required by the framework
export default function MyPage() {
  return <div>Hello</div>;
}
```


---

# Rule: Discriminated Unions

Proactively use discriminated unions to model data that can be in one of a few different shapes. For example, when sending events between environments:

```ts
type UserCreatedEvent = {
  type: "user.created";
  data: { id: string; email: string };
};

type UserDeletedEvent = {
  type: "user.deleted";
  data: { id: string };
};

type Event = UserCreatedEvent | UserDeletedEvent;
```

Use switch statements to handle discriminated unions:

```ts
const handleEvent = (event: Event) => {
  switch (event.type) {
    case "user.created":
      console.log(event.data.email);
      break;
    case "user.deleted":
      console.log(event.data.id);
      break;
  }
};
```

Use discriminated unions to prevent the 'bag of optionals' problem.

For example, when describing a fetching state:

```ts
// BAD - allows impossible states
type FetchingState<TData> = {
  status: "idle" | "loading" | "success" | "error";
  data?: TData;
  error?: Error;
};

// GOOD - prevents impossible states
type FetchingState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: Error };
```

In React props (e.g., polymorphic buttons), use for variants:

```ts
type ButtonProps =
  | { variant: 'solid'; color: string }
  | { variant: 'outline'; borderWidth: number };

function Button(props: ButtonProps) {
  switch (props.variant) {
    case 'solid':
      return <button style={{ background: props.color }} />;
    case 'outline':
      return <button style={{ borderWidth: props.borderWidth }} />;
  }
}
```


---

# Rule: Enums Alternatives

Do not introduce new enums into the codebase. Retain existing enums.

If you require enum-like behaviour, use an `as const` object:

```ts
const backendToFrontendEnum = {
  xs: "EXTRA_SMALL",
  sm: "SMALL",
  md: "MEDIUM",
} as const;

type LowerCaseEnum = keyof typeof backendToFrontendEnum; // "xs" | "sm" | "md"

type UpperCaseEnum = (typeof backendToFrontendEnum)[LowerCaseEnum]; // "EXTRA_SMALL" | "SMALL" | "MEDIUM"
```

Remember that numeric enums behave differently to string enums. Numeric enums produce a reverse mapping:

```ts
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

const direction = Direction.Up; // 0
const directionName = Direction[0]; // "Up"
```

This means that the enum `Direction` above will have eight keys instead of four.

```ts
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

Object.keys(Direction).length; // 8
```


---

# Rule: Error Result Types

Think carefully before implementing code that throws errors.

If a thrown error produces a desirable outcome in the system, go for it. For instance, throwing a custom error inside a backend framework's request handler.

However, for code that you would need a manual try catch for, consider using a result type instead:

```ts
type Result<T, E extends Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

For example, when parsing JSON:

```ts
const parseJson = (input: string): Result<unknown, Error> => {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
};
```

This way you can handle the error in the caller:

```ts
const result = parseJson('{"name": "John"}');

if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```


---

# Rule: Import Type

Use import type whenever you are importing a type.

Prefer top-level `import type` over inline `import { type ... }`.

```ts
// BAD
import { type User } from "./user";
```

```ts
// GOOD
import type { User } from "./user";
```

The reason for this is that in certain environments, the first version's import will not be erased. So you'll be left with:

```ts
// Before transpilation
import { type User } from "./user";

// After transpilation
import "./user";
```


---

# Rule: Interface Extends

ALWAYS prefer interfaces when modelling inheritance.

The `&` operator has terrible performance in TypeScript. Only use it where `interface extends` is not possible.

```ts
// BAD

type A = {
  a: string;
};

type B = {
  b: string;
};

type C = A & B;
```

```ts
// GOOD

interface A {
  a: string;
}

interface B {
  b: string;
}

interface C extends A, B {
  // Additional properties can be added here
}
```


---

# Rule: JSDoc Comments

Use JSDoc comments to annotate functions and types.

Be concise in JSDoc comments, and only provide JSDoc comments if the function's behaviour is not self-evident.

Use the JSDoc inline `@link` tag to link to other functions and types within the same file.

```ts
/**
 * Subtracts two numbers
 */
const subtract = (a: number, b: number) => a - b;

/**
 * Does the opposite to {@link subtract}
 */
const add = (a: number, b: number) => a + b;
```


---

# Rule: No Barrel Files

Avoid barrel files (index.ts/index.js that re-export siblings) in application code. Import modules directly or via private subpath imports defined in package.json so dependencies stay explicit and you don’t inflate the module graph or create import cycles. Use a barrel only for a library entrypoint referenced by package.json, keep it pure re-exports (no side effects or constants), avoid `export *`, and never import that barrel from within the same package.

Example:

```ts
// Avoid (barrel)
// src/tab/index.ts
export { TabList } from "./tab-list";

// Prefer direct import
import { TabList } from "#components/tab/tab-list";
```


---

# Rule: No Unchecked Indexed Access

If the user has this rule enabled in their `tsconfig.json`, indexing into objects and arrays will behave differently from how you expect.

```ts
const obj: Record<string, string> = {};

// With noUncheckedIndexedAccess, value will
// be `string | undefined`
// Without it, value will be `string`
const value = obj.key;
```

```ts
const arr: string[] = [];

// With noUncheckedIndexedAccess, value will
// be `string | undefined`
// Without it, value will be `string`
const value = arr[0];
```


---

# Rule: Optional Properties

Use optional properties extremely sparingly. Only use them when the property is truly optional, and consider whether bugs may be caused by a failure to pass the property.

In the example below we always want to pass user ID to `AuthOptions`. This is because if we forget to pass it somewhere in the code base, it will cause our function to be not authenticated.

```ts
// BAD
type AuthOptions = {
  userId?: string;
};

const func = (options: AuthOptions) => {
  const userId = options.userId;
};
```

```ts
// GOOD
type AuthOptions = {
  userId: string | undefined;
};

const func = (options: AuthOptions) => {
  const userId = options.userId;
};
```

## Exception: React Props with Defaults

Optional properties ARE acceptable in React props when combined with default parameters in the function signature:

```ts
// Type with optional property
type ButtonProps = {
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'md' | 'lg';
};

// Function parameter provides the default
function Button({ variant = 'solid', size = 'md' }: ButtonProps) {
  // variant and size are guaranteed to have values here
  return <button className={`${variant} ${size}`} />;
}
```

This pattern is safe because:

- The default parameter ensures the value is never undefined inside the component
- Omitting the prop at the call site is intentional and clear: `<Button />`
- The default value is documented in one place (the function signature)

Avoid this pattern for:

- Non-React function parameters where callers might forget required config
- Props without sensible defaults that should force explicit decisions
- Situations where forgetting to pass the prop would cause bugs


---

# Rule: Package Manager Detection

Prefer the package.json "packageManager" field to determine the intended package manager (and version); if missing, fall back to lockfiles (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lockb), otherwise default to npm. On conflicts, trust "packageManager" and warn; in monorepos, read the nearest package.json for the targeted workspace.


---

# Rule: Package Manager Execution

In pnpm projects, use `pnpm exec` to run locally installed binaries. Do not use `pnpx`, which is an alias for `pnpm dlx` that downloads packages from the registry and ignores local installations. Use `pnpx` only for one-off commands where you want to run a package without installing it locally.

```bash
pnpm exec tsc --noEmit    # ✅ Uses local package
npx tsc --noEmit          # ✅ Uses local package
pnpx tsc --noEmit         # ❌ Downloads from registry, ignores local
```


---

# Rule: Readonly Properties

Use `readonly` properties for object types by default. This will prevent accidental mutation at runtime.

Omit `readonly` only when the property is genuinely mutable.

```ts
// BAD
type User = {
  id: string;
};

const user: User = {
  id: "1",
};

user.id = "2";
```

```ts
// GOOD
type User = {
  readonly id: string;
};

const user: User = {
  id: "1",
};

user.id = "2"; // Error
```


---

# Rule: Return Types

When declaring functions on the top-level of a module,
declare their return types. This will help future AI
assistants understand the function's purpose.

```ts
const myFunc = (): string => {
  return "hello";
};
```

One exception to this is components which return JSX.
No need to declare the return type of a component,
as it is always JSX.

```tsx
const MyComponent = () => {
  return <div>Hello</div>;
};
```

For React hooks returning objects, annotate: `(): { state: string; }`.


---

# Rule: TypeScript Config File Patterns

Use explicit `include` and `exclude` patterns in environment-specific TypeScript configs to ensure production builds exclude test files and test configs include all necessary sources.

## App/Library Config Pattern

```json
{
  "include": ["src/**/*.ts", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.*", "**/*.spec.*"]
}
```

**Why:**

- `include` captures all source files and type definitions
- `exclude` prevents test files from being compiled into your production bundle
- Test files would add unnecessary code and test framework type dependencies to the build
- Keeps the output bundle clean and minimal

## Test Config Pattern

```json
{
  "include": ["**/*.test.*", "**/*.spec.*", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Why:**

- `include` explicitly matches test files (`.test.*` and `.spec.*` patterns)
- Includes type definitions needed by both app and test code
- Allows test-specific compiler options (like vitest/globals types)
- `exclude` prevents duplicate compilation of dependencies and build artifacts

## Pattern Limitations

TypeScript's glob support is **limited** compared to bash or other tools:

**✅ Supported:**

- `*` - matches any characters except `/`
- `**` - matches any directory depth
- `{a,b}` - brace expansion (alternatives)

**❌ Not Supported:**

- `?(pattern)` - optional groups
- `+(pattern)` - one or more
- `@(pattern)` - exactly one
- `!(pattern)` - negation

**Use simple patterns:** `**/*.test.*` instead of `**/*.{test,spec}.?(c|m)[jt]s?(x)`

## File Selection Priority

TypeScript prioritizes files using this hierarchy:

1. **`files`** (highest priority): Explicitly listed files are always included and cannot be excluded
2. **`include`**: Defines broad sets of files to compile using glob patterns
3. **`exclude`**: Filters out files from those matched by `include`

**Key principle**: If a file matches both `include` and `exclude`, it is **excluded**. Use `exclude` to filter out unwanted files from broad `include` patterns.

**Exception**: Files referenced via `import` statements or triple-slash directives (`/// <reference path="..." />`) can be included even if they match `exclude` patterns


---

# Rule: Zod Schema Naming

Use identical names for Zod schemas and their inferred types. Name both with PascalCase. TypeScript allows this because types and values exist in separate namespaces.

```ts
// CORRECT
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

type User = z.infer<typeof User>;
```

```ts
// AVOID - Redundant suffix
const UserSchema = z.object({ name: z.string() });
type User = z.infer<typeof UserSchema>;
```

Export both the schema and type with the same name. This reduces cognitive load (one concept, one name) and creates unmistakable association between schema and type.
