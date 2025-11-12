/**
 * PTZ (Pan-Tilt-Zoom) control endpoints
 */

import { ReolinkClient } from "./reolink.js";
import { ReolinkHttpError, ReolinkResponse, ReolinkResponseError } from "./types.js";

export interface PtzPreset {
  id: number;
  name?: string;
  enable?: number;
  channel?: number;
  [key: string]: unknown;
}

export interface PtzPresetResponse {
  PtzPreset?: PtzPreset[];
  preset?: PtzPreset[]; // Legacy format
  [key: string]: unknown;
}

export interface PtzCtrlParams {
  channel: number;
  op: "ToPos" | "Stop" | "Left" | "Right" | "Up" | "Down" | "LeftUp" | "LeftDown" | "RightUp" | "RightDown" | "ZoomInc" | "ZoomDec" | "FocusInc" | "FocusDec" | "IrisDec" | "IrisInc" | "Auto" | "StartPatrol" | "StopPatrol";
  speed?: number;
  id?: number; // Preset or patrol ID for ToPos, StartPatrol, StopPatrol operations
  x?: number;
  y?: number;
  z?: number;
}

// RLC-823A/S1 format: preset array with id/speed/dwellTime
export interface PtzPatrolPreset {
  id: number; // Preset ID (1-64)
  speed: number; // Speed (1-64)
  dwellTime: number; // Seconds to stay
  [key: string]: unknown;
}

export interface PtzPatrolConfig {
  channel: number; // Camera channel number (0-based)
  enable: number; // 1 = active
  id: number; // Patrol route index (0-5)
  running?: number; // 1 if currently running
  name?: string; // Patrol route name
  preset: PtzPatrolPreset[];
  [key: string]: unknown;
}

// Legacy format: points array with presetId/speed/stayTime (for other models)
export interface PtzPatrolPoint {
  presetId: number;
  speed: number;
  stayTime: number;
  [key: string]: unknown;
}

// Legacy format (for devices that use preset array with id/dwellTime/speed)
export interface PatrolPreset {
  id: number;
  dwellTime: number;
  speed: number;
}

export interface PtzPatrol {
  channel?: number;
  enable: number | boolean;
  id?: number;
  name?: string;
  preset?: PtzPatrolPreset[] | PatrolPreset[] | null; // RLC-823A/S1 uses preset array
  points?: PtzPatrolPoint[]; // Legacy format (for other models)
  path?: PtzPatrolPoint[]; // Legacy format (for backward compatibility)
  running?: number | boolean;
  [key: string]: unknown;
}

export interface PtzPatrolResponse {
  PtzPatrol?: PtzPatrol | PtzPatrol[];
  [key: string]: unknown;
}

export interface PtzGuardConfig {
  benable: number;
  bexistPos?: number;
  timeout: number;
  channel: number;
  cmdStr?: "setPos" | "toPos";
  bSaveCurrentPos?: number;
  [key: string]: unknown;
}

export interface PtzGuard {
  benable: number;
  bexistPos?: number;
  timeout: number;
  channel?: number;
  // Legacy fields for backward compatibility
  enable?: number | boolean;
  presetId?: number;
  delayTime?: number;
  [key: string]: unknown;
}

export interface PtzGuardResponse {
  PtzGuard?: PtzGuard;
  [key: string]: unknown;
}

/**
 * PTZ pattern/track configuration (note: API uses "Tattern" spelling)
 * Track IDs typically range from 1-6 depending on device model
 */
export interface PtzTatternTrack {
  id: number; // Track ID (typically 1-6)
  name?: string; // Track name
  enable: number; // 1 = enabled, 0 = disabled
  [key: string]: unknown;
}

export interface PtzTattern {
  channel?: number;
  track?: PtzTatternTrack[];
  [key: string]: unknown;
}

export interface PtzTatternResponse {
  PtzTattern?: PtzTattern;
  [key: string]: unknown;
}

/**
 * Get PTZ presets for a channel
 */
export async function getPtzPreset(
  client: ReolinkClient,
  channel: number
): Promise<PtzPresetResponse> {
  const response = await client.api<PtzPresetResponse>("GetPtzPreset", {
    channel,
  });
  
  // Normalize response - some devices use PtzPreset, others use preset
  if (response.PtzPreset && !response.preset) {
    response.preset = response.PtzPreset;
  }
  
  return response;
}

/**
 * Set a PTZ preset at the current camera position
 * 
 * Per PTZ.md: SetPtzPreset wraps params in PtzPreset object.
 * - id: 1-64 (some devices may allow 0)
 * - name: up to 31 chars
 * - enable: optional, omit to only rename
 * 
 * @throws Error if preset ID is out of range (0-64) or name exceeds 31 characters
 */
export async function setPtzPreset(
  client: ReolinkClient,
  channel: number,
  id: number,
  name?: string,
  enable?: number
): Promise<unknown> {
  // Validate preset ID range (allow 0-64 for device compatibility)
  if (id < 0 || id > 64) {
    throw new Error(`Preset ID must be between 0 and 64, got: ${id}`);
  }

  // Validate preset name length per API spec
  const presetName = name || `Preset ${id}`;
  if (presetName.length > 31) {
    throw new Error(`Preset name must not exceed 31 characters, got: ${presetName.length}`);
  }

  const preset: Record<string, unknown> = {
    channel,
    id,
    name: presetName,
  };
  
  // Only include enable if explicitly provided
  if (enable !== undefined) {
    preset.enable = enable;
  }

  return client.api("SetPtzPreset", {
    PtzPreset: preset,
  });
}

/**
 * Control PTZ movement
 * 
 * Per PTZ.md: PtzCtrl supports operations like Left, Right, Up, Down, ToPos, StartPatrol, StopPatrol, etc.
 * - For ToPos: requires `id` parameter (preset ID 0-64, spec says 1-64 but some devices allow 0) and optional `speed` (1-64)
 * - For StartPatrol/StopPatrol: requires `id` parameter (patrol ID 0-5)
 * - For directional moves (Left, Right, Up, Down, etc.): requires `speed` parameter (1-64)
 * - Unused params should be set to 0
 * 
 * @throws Error if preset/patrol ID or speed is out of valid range
 */
export async function ptzCtrl(
  client: ReolinkClient,
  params: PtzCtrlParams
): Promise<unknown> {
  // Validate speed range per API spec (1-64)
  if (params.speed !== undefined && (params.speed < 1 || params.speed > 64)) {
    throw new Error(`PTZ speed must be between 1 and 64, got: ${params.speed}`);
  }

  // Validate preset ID for ToPos operation (0-64, allowing 0 for device compatibility)
  if (params.op === "ToPos" && params.id !== undefined) {
    if (params.id < 0 || params.id > 64) {
      throw new Error(`Preset ID must be between 0 and 64, got: ${params.id}`);
    }
  }

  // Validate patrol ID for StartPatrol/StopPatrol operations (0-5)
  if ((params.op === "StartPatrol" || params.op === "StopPatrol") && params.id !== undefined) {
    if (params.id < 0 || params.id > 5) {
      throw new Error(`Patrol ID must be between 0 and 5, got: ${params.id}`);
    }
  }

  const apiParams: Record<string, unknown> = {
    channel: params.channel,
    op: params.op,
  };

  // Add speed if provided
  if (params.speed !== undefined) {
    apiParams.speed = params.speed;
  }

  // Add id for ToPos (preset) or StartPatrol/StopPatrol operations
  if (params.id !== undefined && (params.op === "ToPos" || params.op === "StartPatrol" || params.op === "StopPatrol")) {
    apiParams.id = params.id;
  }

  // Add x, y, z for absolute positioning (if supported)
  if (params.op === "ToPos" && params.x !== undefined && params.y !== undefined) {
    apiParams.x = params.x;
    apiParams.y = params.y;
    if (params.z !== undefined) {
      apiParams.z = params.z;
    }
  }

  return client.api("PtzCtrl", apiParams);
}

/**
 * Map rspCode to ReolinkHttpError with proper messages
 */
function handlePtzError(rspCode: number, command: string): never {
  switch (rspCode) {
    case 0:
      throw new Error("handlePtzError called with success code (0) - this should not happen");
    case -1:
      throw new ReolinkHttpError(1, -1, "Invalid preset or position", command);
    case -4:
      throw new ReolinkHttpError(1, -4, "Parameter format error", command);
    case -9:
      throw new ReolinkHttpError(1, -9, "Not supported on this model", command);
    default:
      throw new ReolinkHttpError(1, rspCode, `Unknown PTZ error ${rspCode}`, command);
  }
}

/**
 * Get PTZ guard mode configuration
 */
export async function getPtzGuard(
  client: ReolinkClient,
  channel: number
): Promise<PtzGuardConfig> {
  const response = await client.api<PtzGuardResponse>("GetPtzGuard", {
    channel,
  });
  
  if (response?.PtzGuard) {
    return {
      benable: response.PtzGuard.benable,
      bexistPos: response.PtzGuard.bexistPos,
      timeout: response.PtzGuard.timeout,
      channel: response.PtzGuard.channel ?? channel,
    };
  }
  
  // Return default if not found
  return {
    benable: 0,
    timeout: 60,
    channel,
  };
}

/**
 * Set PTZ guard mode configuration
 * Note: For RLC-823A/S1, guard mode binds to the current camera position.
 * To change guard position: move PTZ to desired position, then call this function.
 * @param channel - Camera channel number (0-based)
 * @param options - Guard configuration options
 * @throws ReolinkHttpError with rspCode -1 if preset/position invalid, -9 if not supported
 */
export async function setPtzGuard(
  client: ReolinkClient,
  channel: number,
  options: Partial<PtzGuardConfig>
): Promise<void> {
  const guardConfig: PtzGuardConfig = {
    benable: options.benable ?? 0,
    timeout: options.timeout ?? 60,
    channel,
    cmdStr: options.cmdStr ?? "setPos",
    bSaveCurrentPos: options.bSaveCurrentPos ?? 1,
    ...(options.bexistPos !== undefined && { bexistPos: options.bexistPos }),
  };

  try {
    const response = await client.api<ReolinkResponse>("SetPtzGuard", {
      channel,
      PtzGuard: guardConfig,
    });

    // Check for error in response
    if (response && typeof response === "object" && "error" in response) {
      const errorResponse = response as ReolinkResponseError;
      if (errorResponse.error) {
        handlePtzError(errorResponse.error.rspCode, "SetPtzGuard");
      }
    }
  } catch (error) {
    if (error instanceof ReolinkHttpError) {
      throw error;
    }
    // If error has rspCode, map it
    if (error instanceof Error && "rspCode" in error) {
      const httpError = error as { rspCode: number };
      handlePtzError(httpError.rspCode, "SetPtzGuard");
    }
    throw error;
  }
}

/**
 * Toggle PTZ guard mode (switches between on/off based on current state)
 */
export async function toggleGuardMode(
  client: ReolinkClient,
  channel: number
): Promise<void> {
  const current = await getPtzGuard(client, channel);
  const isEnabled = current.benable === 1;
  const timeout = current.timeout ?? 60;

  await setPtzGuard(client, channel, {
    benable: isEnabled ? 0 : 1,
    timeout,
  });
}

/**
 * Get PTZ patrol configuration
 */
export async function getPtzPatrol(
  client: ReolinkClient,
  channel: number
): Promise<PtzPatrolConfig[]> {
  const response = await client.api<PtzPatrolResponse>("GetPtzPatrol", {
    channel,
  });

  if (response?.PtzPatrol) {
    const patrols = Array.isArray(response.PtzPatrol) ? response.PtzPatrol : [response.PtzPatrol];
    return patrols
      .filter((p): p is PtzPatrol => p !== null && typeof p === "object")
      .map((p) => ({
        channel: p.channel ?? channel,
        enable: typeof p.enable === "boolean" ? (p.enable ? 1 : 0) : (p.enable as number),
        id: p.id ?? 0,
        running: typeof p.running === "boolean" ? (p.running ? 1 : 0) : (p.running as number | undefined),
        name: p.name,
        preset:
          p.preset && Array.isArray(p.preset)
            ? p.preset.map((preset) => ({
                id: "id" in preset ? preset.id : 0,
                speed: "speed" in preset ? preset.speed : 32,
                dwellTime: "dwellTime" in preset ? preset.dwellTime : "dwellTime" in preset ? (preset as { dwellTime: number }).dwellTime : 10,
              }))
            : [],
      }));
  }

  return [];
}

/**
 * Set PTZ patrol configuration
 * @param channel - Camera channel number (0-based)
 * @param config - Patrol configuration object (RLC-823A/S1 format with points, or legacy format)
 * @throws Error if patrol ID is out of range (0-5), preset array exceeds 16 steps, or preset IDs/speeds are invalid
 */
export async function setPtzPatrol(
  client: ReolinkClient,
  channel: number,
  config: PtzPatrolConfig | PtzPatrol
): Promise<void> {
  // Validate patrol ID range per API spec (0-5)
  if ("id" in config && typeof config.id === "number" && (config.id < 0 || config.id > 5)) {
    throw new Error(`Patrol ID must be between 0 and 5, got: ${config.id}`);
  }

  // Validate preset array length and contents
  const presetArray = config.preset || ("points" in config ? config.points : null) || ("path" in config ? config.path : null);
  if (Array.isArray(presetArray)) {
    // Validate max 16 steps per API spec
    if (presetArray.length > 16) {
      throw new Error(`Patrol can have at most 16 preset steps, got: ${presetArray.length}`);
    }

    // Validate each preset step
    presetArray.forEach((step, index) => {
      if (typeof step === 'object' && step !== null) {
        const presetId = 'id' in step ? (step as { id?: number }).id : 
                        'presetId' in step ? (step as { presetId?: number }).presetId : undefined;
        const speed = 'speed' in step ? (step as { speed?: number }).speed : undefined;

        // Validate preset ID (0-64, allowing 0 for device compatibility)
        if (typeof presetId === 'number' && (presetId < 0 || presetId > 64)) {
          throw new Error(`Patrol step ${index}: preset ID must be between 0 and 64, got: ${presetId}`);
        }

        // Validate speed (1-64)
        if (typeof speed === 'number' && (speed < 1 || speed > 64)) {
          throw new Error(`Patrol step ${index}: speed must be between 1 and 64, got: ${speed}`);
        }
      }
    });
  }

  try {
    // Check if config uses RLC-823A/S1 format (PtzPatrolConfig with preset array)
    // RLC-823A/S1 format: has preset array with id/speed/dwellTime structure, no "name" field
    // Legacy format: may have "name" field or different structure
    const hasPresetArray = "preset" in config && Array.isArray(config.preset) && config.preset.length > 0;
    const hasNameField = "name" in config;
    
    if (hasPresetArray && !hasNameField && "id" in config && config.preset) {
      // Check if preset items have RLC-823A/S1 structure (id/speed/dwellTime)
      const firstPreset = config.preset[0];
      const hasRlcPresetStructure = 
        typeof firstPreset === "object" &&
        firstPreset !== null &&
        "id" in firstPreset &&
        "speed" in firstPreset &&
        "dwellTime" in firstPreset;
      
      if (hasRlcPresetStructure) {
        // RLC-823A/S1 format: PtzPatrolConfig with preset array (id/speed/dwellTime)
        const configId = typeof (config as PtzPatrolConfig).id === "number" ? (config as PtzPatrolConfig).id : 0;
        const enableValue = typeof config.enable === "boolean" ? (config.enable ? 1 : 0) : (config.enable as number);
        const patrolConfig: PtzPatrolConfig = {
          channel: (config as PtzPatrolConfig).channel ?? channel,
          id: configId,
          enable: enableValue,
          preset: config.preset as PtzPatrolPreset[],
        };

        try {
          const response = await client.api<ReolinkResponse>("SetPtzPatrol", {
            channel,
            PtzPatrol: patrolConfig,
          });

          if (response && typeof response === "object" && "error" in response) {
            const errorResponse = response as ReolinkResponseError;
            if (errorResponse.error) {
              handlePtzError(errorResponse.error.rspCode, "SetPtzPatrol");
            }
          }
        } catch (error) {
          if (error instanceof ReolinkHttpError) {
            throw error;
          }
          if (error instanceof Error && "rspCode" in error) {
            const httpError = error as { rspCode: number };
            handlePtzError(httpError.rspCode, "SetPtzPatrol");
          }
          throw error;
        }
        return;
      }
    }
    
    if (hasPresetArray && hasNameField) {
      // Legacy format with name field - pass through as-is
      const patrolConfig: Record<string, unknown> = {
        ...config,
        channel,
      };

      if (typeof patrolConfig.enable === "boolean") {
        patrolConfig.enable = patrolConfig.enable ? 1 : 0;
      }

      try {
        const response = await client.api<ReolinkResponse>("SetPtzPatrol", patrolConfig);
        if (response && typeof response === "object" && "error" in response) {
          const errorResponse = response as ReolinkResponseError;
          if (errorResponse.error) {
            handlePtzError(errorResponse.error.rspCode, "SetPtzPatrol");
          }
        }
      } catch (error) {
        if (error instanceof ReolinkHttpError) {
          throw error;
        }
        if (error instanceof Error && "rspCode" in error) {
          const httpError = error as { rspCode: number };
          handlePtzError(httpError.rspCode, "SetPtzPatrol");
        }
        throw error;
      }
      return;
    } else if ("points" in config && Array.isArray(config.points) && "id" in config) {
      // Legacy format with points array (presetId/speed/stayTime) - convert to preset format
      const configId = typeof (config as { id?: number }).id === "number" ? (config as { id: number }).id : 0;
      const enableValue = typeof config.enable === "boolean" ? (config.enable ? 1 : 0) : (config.enable as number);
      const patrolConfig: PtzPatrolConfig = {
        channel,
        id: configId,
        enable: enableValue,
        preset: config.points.map((p) => ({
          id: p.presetId,
          speed: p.speed,
          dwellTime: p.stayTime,
        })),
      };

      try {
        const response = await client.api<ReolinkResponse>("SetPtzPatrol", {
          channel,
          PtzPatrol: patrolConfig,
        });

        if (response && typeof response === "object" && "error" in response) {
          const errorResponse = response as ReolinkResponseError;
          if (errorResponse.error) {
            handlePtzError(errorResponse.error.rspCode, "SetPtzPatrol");
          }
        }
      } catch (error) {
        if (error instanceof ReolinkHttpError) {
          throw error;
        }
        if (error instanceof Error && "rspCode" in error) {
          const httpError = error as { rspCode: number };
          handlePtzError(httpError.rspCode, "SetPtzPatrol");
        }
        throw error;
      }
      return;
    } else if ("path" in config && Array.isArray(config.path)) {
      // Legacy format with path array - convert to preset format
      const patrolConfig: PtzPatrolConfig = {
        channel,
        id: (config as PtzPatrol).id || 0,
        enable: typeof config.enable === "boolean" ? (config.enable ? 1 : 0) : (config.enable as number),
        preset: config.path.map((p) => ({
          id: p.presetId,
          speed: p.speed,
          dwellTime: p.stayTime,
        })),
      };

      try {
        const response = await client.api<ReolinkResponse>("SetPtzPatrol", {
          channel,
          PtzPatrol: patrolConfig,
        });

        if (response && typeof response === "object" && "error" in response) {
          const errorResponse = response as ReolinkResponseError;
          if (errorResponse.error) {
            handlePtzError(errorResponse.error.rspCode, "SetPtzPatrol");
          }
        }
      } catch (error) {
        if (error instanceof ReolinkHttpError) {
          throw error;
        }
        if (error instanceof Error && "rspCode" in error) {
          const httpError = error as { rspCode: number };
          handlePtzError(httpError.rspCode, "SetPtzPatrol");
        }
        throw error;
      }
      return;
    } else {
    // Legacy format: PtzPatrol with preset array or other structure
    const patrolConfig: Record<string, unknown> = {
      ...config,
      channel,
    };

    // Convert enable boolean to number if needed
    if (typeof patrolConfig.enable === "boolean") {
      patrolConfig.enable = patrolConfig.enable ? 1 : 0;
    }

    // If preset array exists, keep it as-is (some devices use this format)
    return client.api("SetPtzPatrol", patrolConfig);
    }
  } catch (error) {
    if (error instanceof ReolinkHttpError) {
      throw error;
    }
    if (error instanceof Error && "rspCode" in error) {
      const httpError = error as { rspCode: number };
      handlePtzError(httpError.rspCode, "SetPtzPatrol");
    }
    throw error;
  }
}

/**
 * Start a patrol route
 * @param channel - Camera channel number (0-based)
 * @param patrolId - Patrol route ID (0-5)
 * @throws Error if patrol ID is out of range (0-5)
 */
export async function startPatrol(
  client: ReolinkClient,
  channel: number,
  patrolId: number
): Promise<void> {
  // Validate patrol ID range per API spec (0-5)
  if (patrolId < 0 || patrolId > 5) {
    throw new Error(`Patrol ID must be between 0 and 5, got: ${patrolId}`);
  }

  try {
    const response = await client.api<ReolinkResponse>("PtzCtrl", {
      channel,
      op: "StartPatrol",
      id: patrolId,
    });

    if (response && typeof response === "object" && "error" in response) {
      const errorResponse = response as ReolinkResponseError;
      if (errorResponse.error) {
        handlePtzError(errorResponse.error.rspCode, "PtzCtrl");
      }
    }
  } catch (error) {
    if (error instanceof ReolinkHttpError) {
      throw error;
    }
    if (error instanceof Error && "rspCode" in error) {
      const httpError = error as { rspCode: number };
      handlePtzError(httpError.rspCode, "PtzCtrl");
    }
    throw error;
  }
}

/**
 * Stop a patrol route
 * @param channel - Camera channel number (0-based)
 * @param patrolId - Patrol route ID (0-5)
 * @throws Error if patrol ID is out of range (0-5)
 */
export async function stopPatrol(
  client: ReolinkClient,
  channel: number,
  patrolId: number
): Promise<void> {
  // Validate patrol ID range per API spec (0-5)
  if (patrolId < 0 || patrolId > 5) {
    throw new Error(`Patrol ID must be between 0 and 5, got: ${patrolId}`);
  }

  try {
    const response = await client.api<ReolinkResponse>("PtzCtrl", {
      channel,
      op: "StopPatrol",
      id: patrolId,
    });

    if (response && typeof response === "object" && "error" in response) {
      const errorResponse = response as ReolinkResponseError;
      if (errorResponse.error) {
        handlePtzError(errorResponse.error.rspCode, "PtzCtrl");
      }
    }
  } catch (error) {
    if (error instanceof ReolinkHttpError) {
      throw error;
    }
    if (error instanceof Error && "rspCode" in error) {
      const httpError = error as { rspCode: number };
      handlePtzError(httpError.rspCode, "PtzCtrl");
    }
    throw error;
  }
}

