/**
 * Common domain types for representing usage data across different services
 */

/**
 * A single usage window/period with utilization data
 */
export type UsageWindow = {
  readonly name: string;
  readonly utilization: number; // Percentage (0-100)
  readonly resetsAt: Date | undefined;
  readonly periodDurationMs: number;
};

/**
 * Complete usage data for a service
 */
export type ServiceUsageData = {
  readonly service: string;
  readonly planType?: string;
  readonly windows: readonly UsageWindow[];
  readonly metadata?: {
    readonly allowed?: boolean;
    readonly limitReached?: boolean;
  };
};

/**
 * Result type for API operations
 */
export type Result<T, E extends Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * Base error class for API errors
 */
export class ApiError extends Error {
  readonly status?: number;
  readonly body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Service adapter interface
 */
export interface ServiceAdapter {
  readonly name: string;
  fetchUsage(): Promise<Result<ServiceUsageData, ApiError>>;
}

/**
 * Result of fetching usage for a single service
 */
export type ServiceResult = {
  readonly service: string;
  readonly result: Result<ServiceUsageData, ApiError>;
};
