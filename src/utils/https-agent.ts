/**
 * HTTPS Agent Utility
 *
 * Provides centralized configuration for insecure HTTPS connections
 * using either Node.js https.Agent or undici's Agent (dispatcher).
 */

import https from "https";
import { fetch as undiciFetch, Agent as UndiciAgent } from "undici";

/**
 * Create fetch options with optional insecure SSL configuration.
 *
 * When insecure mode is enabled, creates an agent/dispatcher that skips
 * SSL certificate verification (equivalent to curl -k).
 *
 * @param insecure - Whether to skip SSL certificate verification
 * @param fetchImpl - The fetch implementation being used
 * @param baseOptions - Base RequestInit options to extend
 * @returns Extended RequestInit with agent/dispatcher if insecure
 *
 * @example
 * ```typescript
 * const options = createFetchOptions(true, fetch, {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify(data),
 * });
 * await fetchImpl(url, options);
 * ```
 */
export function createFetchOptions(
  insecure: boolean,
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  baseOptions: RequestInit = {}
): RequestInit {
  const options = { ...baseOptions };

  if (insecure) {
    // Check if we're using undici fetch by comparing function references
    // or checking if the global fetch is different from undici's fetch
    const isUndiciFetch =
      fetchImpl === undiciFetch ||
      (fetchImpl !== globalThis.fetch && fetchImpl.toString().includes("undici"));

    if (isUndiciFetch) {
      // Use undici's dispatcher for undici fetch
      const dispatcher = new UndiciAgent({
        connect: {
          rejectUnauthorized: false,
        },
      });
      (options as { dispatcher?: UndiciAgent }).dispatcher = dispatcher;
    } else {
      // Use Node.js https agent for other fetch implementations
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });
      (options as { agent?: https.Agent }).agent = agent;
    }
  }

  return options;
}

/**
 * Check if a fetch implementation is the undici fetch.
 *
 * @param fetchImpl - The fetch implementation to check
 * @returns True if the fetch implementation is undici
 */
export function isUndiciFetch(
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
): boolean {
  return (
    fetchImpl === undiciFetch ||
    (fetchImpl !== globalThis.fetch && fetchImpl.toString().includes("undici"))
  );
}
