declare module "env-paths" {
  interface EnvironmentPathsOptions {
    readonly suffix?: string;
  }

  interface EnvironmentPathsResult {
    readonly cache: string;
    readonly config: string;
    readonly data: string;
    readonly log: string;
    readonly temp: string;
  }

  // eslint-disable-next-line unicorn/prevent-abbreviations -- Matches the library's public API
  export default function envPaths(
    name: string,
    options?: EnvironmentPathsOptions,
  ): EnvironmentPathsResult;
}
