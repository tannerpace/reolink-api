/**
 * AI configuration and state endpoints
 *
 * This module provides functions to query AI detection settings and real-time AI detection state
 * for Reolink cameras. AI features typically include person detection, vehicle detection, pet detection,
 * and other smart detection capabilities depending on camera model.
 */

import { ReolinkClient } from "./reolink.js";

/**
 * Response from GetAiCfg command containing AI detection configuration.
 *
 * Typically includes settings for person detection, vehicle detection, and other AI features.
 * The exact structure varies by camera model and firmware version.
 *
 * @example
 * ```typescript
 * {
 *   AiCfg: {
 *     channel: 0,
 *     people: { enable: 1, sensitivity: 50 },
 *     vehicle: { enable: 1, sensitivity: 50 },
 *     pet: { enable: 0, sensitivity: 30 }
 *   }
 * }
 * ```
 */
export interface AiCfgResponse {
  [key: string]: unknown;
}

/**
 * Response from GetAiState command containing real-time AI detection state.
 *
 * Reports the current alarm state for each AI detection type. The alarm state
 * typically indicates whether a detection event is currently active (1) or not (0).
 *
 * @example
 * ```typescript
 * {
 *   AiState: {
 *     channel: 0,
 *     people: { alarmState: 1 },
 *     vehicle: { alarmState: 0 },
 *     pet: { alarmState: 0 }
 *   }
 * }
 * ```
 */
export interface AiStateResponse {
  [key: string]: unknown;
}

/**
 * Get AI detection configuration for a specific camera channel.
 *
 * Retrieves the current AI detection settings including enabled features,
 * sensitivity levels, and detection zones for person, vehicle, pet, and other
 * AI capabilities supported by the camera.
 *
 * @param client - The authenticated ReolinkClient instance
 * @param channel - The zero-based camera channel number
 * @returns Promise resolving to AI configuration data
 * @throws {ReolinkHttpError} When the API request fails or returns an error
 *
 * @example
 * ```typescript
 * const aiConfig = await getAiCfg(client, 0);
 * console.log(aiConfig.AiCfg.people.enable); // 1 if person detection enabled
 * ```
 */
export async function getAiCfg(
  client: ReolinkClient,
  channel: number
): Promise<AiCfgResponse> {
  return client.api<AiCfgResponse>("GetAiCfg", {
    channel,
  });
}

/**
 * Get real-time AI detection state for a specific camera channel.
 *
 * Queries the current alarm state for AI detection features. Use this to check
 * whether person, vehicle, pet, or other AI detections are currently active.
 * The state reflects real-time detection events.
 *
 * @param client - The authenticated ReolinkClient instance
 * @param channel - The zero-based camera channel number
 * @returns Promise resolving to current AI detection state
 * @throws {ReolinkHttpError} When the API request fails or returns an error
 *
 * @example
 * ```typescript
 * const aiState = await getAiState(client, 0);
 * if (aiState.AiState.people?.alarmState === 1) {
 *   console.log("Person detected!");
 * }
 * ```
 */
export async function getAiState(
  client: ReolinkClient,
  channel: number
): Promise<AiStateResponse> {
  return client.api<AiStateResponse>("GetAiState", {
    channel,
  });
}

