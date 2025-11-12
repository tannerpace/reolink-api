/**
 * Core types for Reolink API requests and responses
 */

/**
 * Session token object returned by login
 * 
 * @property name - The token string to use in subsequent requests
 * @property leaseTime - Token validity period in seconds (typically 3600)
 */
export interface ReolinkToken {
  name: string;
  leaseTime?: number;
}

/**
 * Structure of a Reolink API request
 * 
 * @typeParam T - Type of the parameter object
 * @property cmd - API command name (e.g., "GetDevInfo", "PtzCtrl")
 * @property action - Action type (0 or 1, varies by command)
 * @property param - Command-specific parameters
 */
export interface ReolinkRequest<T = Record<string, unknown>> {
  cmd: string;
  action: number;
  param: T;
}

/**
 * Error information from failed API calls
 * 
 * @property rspCode - Device-specific error code (e.g., -1 for invalid token)
 * @property detail - Human-readable error description
 */
export interface ReolinkError {
  rspCode: number;
  detail: string;
}

/**
 * Successful API response with data
 * 
 * @typeParam T - Type of the response value
 * @property code - Success code (always 0)
 * @property value - Response data from the device
 */
export interface ReolinkResponseSuccess<T = unknown> {
  code: 0;
  value: T;
  error?: never;
}

/**
 * Failed API response with error information
 * 
 * @property code - Non-zero error code
 * @property error - Error details
 */
export interface ReolinkResponseError {
  code: number;
  value?: never;
  error: ReolinkError;
}

/**
 * Union type for all possible API responses
 * 
 * @typeParam T - Type of the successful response value
 */
export type ReolinkResponse<T = unknown> =
  | ReolinkResponseSuccess<T>
  | ReolinkResponseError;

/**
 * Custom error class for Reolink API errors
 * 
 * Thrown when an API request fails due to HTTP errors or device-level errors.
 * Provides structured access to error codes and details for error handling.
 * 
 * @property code - HTTP status code or general error code
 * @property rspCode - Device-specific response code (e.g., -1 for invalid token, -9 for not supported)
 * @property detail - Human-readable error description from the device
 * 
 * @example
 * ```typescript
 * try {
 *   await client.api("PlaybackStart", { channel: 0, startTime: "..." });
 * } catch (error) {
 *   if (error instanceof ReolinkHttpError) {
 *     if (error.rspCode === -9) {
 *       console.log("Playback not supported on this device");
 *     }
 *   }
 * }
 * ```
 */
export class ReolinkHttpError extends Error {
  public readonly code: number;
  public readonly rspCode: number;
  public readonly detail: string;

  /**
   * Creates a new ReolinkHttpError
   * 
   * @param code - HTTP status code or general error code
   * @param rspCode - Device-specific response code
   * @param detail - Error description
   * @param command - Optional command name to include in the error message
   */
  constructor(code: number, rspCode: number, detail: string, command?: string) {
    const message = command
      ? `${command} ERROR: ${detail} (${rspCode})`
      : `${detail} (${rspCode})`;
    super(message);
    this.name = "ReolinkHttpError";
    this.code = code;
    this.rspCode = rspCode;
    this.detail = detail;
  }
}

