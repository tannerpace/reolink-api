/**
 * Capability detection and feature guards
 */

import { ReolinkClient } from "./reolink.js";
import { getAbility } from "./endpoints/system.js";

/**
 * Device capability flags detected from GetAbility response
 * 
 * @property ptz - Pan-Tilt-Zoom control support
 * @property ai - AI detection support (people, vehicles, pets, etc.)
 * @property motionDetection - Motion detection support
 * @property recording - Recording/playback support
 */
export interface DeviceCapabilities {
  ptz?: boolean;
  ai?: boolean;
  motionDetection?: boolean;
  recording?: boolean;
  [key: string]: unknown;
}

/**
 * Detect device capabilities from GetAbility response
 * 
 * Queries the device's GetAbility endpoint and parses the response to determine
 * which features are supported (PTZ, AI detection, motion detection, recording).
 * 
 * The function handles various response formats including both uppercase and lowercase
 * capability keys (e.g., "Ptz" vs "ptz", "AI" vs "ai"). It also recognizes alternative
 * keys like "Person" for AI detection.
 * 
 * @param client - The authenticated Reolink client
 * @returns Promise resolving to detected capabilities, or empty object if GetAbility fails
 * 
 * @example
 * ```typescript
 * const caps = await detectCapabilities(client);
 * if (caps.ptz) {
 *   await ptzCtrl(client, { channel: 0, op: "Left", speed: 32 });
 * }
 * ```
 */
export async function detectCapabilities(
  client: ReolinkClient
): Promise<DeviceCapabilities> {
  try {
    const ability = await getAbility(client);
    const caps: DeviceCapabilities = {};

    // Check for PTZ support
    // Common ability keys that indicate PTZ support
    if (
      ability.Ptz ||
      ability.ptz ||
      (typeof ability === "object" &&
        ability !== null &&
        ("Ptz" in ability || "ptz" in ability))
    ) {
      caps.ptz = true;
    }

    // Check for AI support
    if (
      ability.AI ||
      ability.ai ||
      (typeof ability === "object" &&
        ability !== null &&
        ("AI" in ability || "ai" in ability || "Person" in ability))
    ) {
      caps.ai = true;
    }

    // Check for motion detection
    if (
      ability.Md ||
      ability.md ||
      (typeof ability === "object" &&
        ability !== null &&
        ("Md" in ability || "md" in ability || "Motion" in ability))
    ) {
      caps.motionDetection = true;
    }

    // Check for recording
    if (
      ability.Rec ||
      ability.rec ||
      (typeof ability === "object" &&
        ability !== null &&
        ("Rec" in ability || "rec" in ability || "Record" in ability))
    ) {
      caps.recording = true;
    }

    return caps;
  } catch (error) {
    // If GetAbility fails, return empty capabilities
    return {};
  }
}

/**
 * Guard function to check if a feature is supported before use
 * 
 * Throws an error if the specified capability is not present or is falsy.
 * Use this to enforce feature requirements at runtime and provide clear
 * error messages when a device lacks expected functionality.
 * 
 * @param capabilities - The detected device capabilities
 * @param feature - The capability key to check
 * @throws Error if the feature is not supported, listing available capabilities
 * 
 * @example
 * ```typescript
 * const caps = await detectCapabilities(client);
 * requireCapability(caps, "ptz"); // throws if PTZ not supported
 * await ptzCtrl(client, { channel: 0, op: "ToPos", id: 1 });
 * ```
 */
export function requireCapability(
  capabilities: DeviceCapabilities,
  feature: keyof DeviceCapabilities
): void {
  if (!capabilities[feature]) {
    throw new Error(
      `Feature '${feature}' is not supported on this device. Available capabilities: ${Object.keys(capabilities).join(", ")}`
    );
  }
}

/**
 * Helper to get capabilities and check feature support
 * 
 * Combines detectCapabilities and feature checking into a single call.
 * Useful for quick feature checks without needing to store capabilities.
 * 
 * @param client - The authenticated Reolink client
 * @param feature - The capability key to check
 * @returns Promise resolving to true if feature is supported, false otherwise
 * 
 * @example
 * ```typescript
 * if (await checkFeature(client, "ptz")) {
 *   console.log("PTZ control available");
 * } else {
 *   console.log("This is a fixed camera");
 * }
 * ```
 */
export async function checkFeature(
  client: ReolinkClient,
  feature: keyof DeviceCapabilities
): Promise<boolean> {
  const caps = await detectCapabilities(client);
  return caps[feature] === true;
}

