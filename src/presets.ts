import { ReolinkClient } from "./reolink.js";
import { ReolinkHttpError } from "./types.js";
import type { PtzTatternResponse } from "./ptz.js";

export type PresetId = number; // 1..64

export interface PtzPreset {
  id: PresetId;
  name: string;
  enable: boolean;
  channel: number;
}

export type AiType = "people" | "vehicle" | "dog_cat" | "face";

export interface GridArea {
  width: number;
  height: number;
  bits: string;
}

export interface PresetZones {
  md?: GridArea;
  ai?: Partial<Record<AiType, GridArea>>;
  masks?: Array<{
    screen: { width: number; height: number };
    block: { x: number; y: number; width: number; height: number };
  }>;
}

export interface PresetRecord {
  preset: PtzPreset;
  zones?: PresetZones;
}

export interface PtzMoveOptions {
  speed?: number;
  settleMs?: number;
}

export interface GuardOptions {
  enable?: boolean;
  timeoutSec?: number;
  setCurrentAsGuard?: boolean;
  goToGuardNow?: boolean;
}

export interface PanoramaPlan {
  panStep: number;
  tiltStep: number;
  settleMs?: number;
  snapshotMode?: "snap" | "framegrab";
  maxTiles?: number;
}

const DEFAULT_SETTLE_MS = 400;
const SUPPORTED_AI_TYPES: AiType[] = ["people", "vehicle", "dog_cat", "face"];
type CanvasResult =
  | Buffer
  | (typeof globalThis extends { HTMLCanvasElement: infer T } ? T : never);

// Internal API response types
interface MdScopePayload {
  cols?: number;
  width?: number;
  rows?: number;
  height?: number;
  table?: string;
  area?: string;
  bits?: string;
}

interface AiAreaPayload {
  width?: number;
  cols?: number;
  height?: number;
  rows?: number;
  area?: string;
  table?: string;
  bits?: string;
}

interface PresetPayload {
  id?: number;
  ID?: number;
  name?: string;
  Name?: string;
  enable?: number | boolean;
  channel?: number;
  Channel?: number;
}

interface GetPtzPresetResponse {
  PtzPreset?: {
    preset?: PresetPayload[];
  } | PresetPayload[];
  preset?: PresetPayload | PresetPayload[];
  Presets?: PresetPayload | PresetPayload[];
  [key: string]: unknown; // Allow dynamic property access for fallback parsing
}

interface ZoomFocusResponse {
  ZoomFocus?: {
    Focus?: { pos?: number };
    focus?: { pos?: number };
    Zoom?: { pos?: number };
    zoom?: { pos?: number };
  };
  Focus?: { pos?: number };
  focus?: { pos?: number };
  Zoom?: { pos?: number };
  zoom?: { pos?: number };
}

interface PtzGuardResponse {
  PtzGuard?: {
    benable?: number;
    bexistPos?: number;
    bExistPos?: number;
    timeout?: number;
  };
  benable?: number;
  bexistPos?: number;
  bExistPos?: number;
  timeout?: number;
}

interface PtzCheckStateResponse {
  PtzCheckState?: {
    state?: number;
  };
  state?: number;
}

interface MdAlarmResponse {
  MdAlarm?: MdScopePayload & {
    scope?: MdScopePayload;
    Scope?: MdScopePayload;
    [key: string]: unknown;
  };
  Alarm?: MdScopePayload & {
    scope?: MdScopePayload;
    [key: string]: unknown;
  };
  scope?: MdScopePayload;
  Scope?: MdScopePayload;
}

interface AiCfgResponse {
  AiCfg?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AiAlarmResponse {
  AiAlarm?: {
    scope?: AiAreaPayload & {
      area?: string;
      Scope?: AiAreaPayload;
    };
    Scope?: AiAreaPayload;
  };
  scope?: AiAreaPayload;
  Scope?: AiAreaPayload;
}

interface MaskResponse {
  Mask?: {
    area?: Array<{
      screen: { width: number; height: number };
      block: { x: number; y: number; width: number; height: number };
    }>;
    areas?: Array<{
      screen: { width: number; height: number };
      block: { x: number; y: number; width: number; height: number };
    }>;
  };
  mask?: {
    area?: Array<{
      screen: { width: number; height: number };
      block: { x: number; y: number; width: number; height: number };
    }>;
    areas?: Array<{
      screen: { width: number; height: number };
      block: { x: number; y: number; width: number; height: number };
    }>;
  };
  area?: Array<{
    screen: { width: number; height: number };
    block: { x: number; y: number; width: number; height: number };
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface AbilityResponse {
  Ability?: Record<string, unknown>;
  [key: string]: unknown;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeMdScope(scope: MdScopePayload): GridArea {
  const width = scope?.cols ?? scope?.width;
  const height = scope?.rows ?? scope?.height;
  const table = scope?.table ?? scope?.area ?? scope?.bits;
  if (!width || !height || typeof table !== "string") {
    throw new Error("Invalid motion detection scope received from device");
  }
  if (table.length !== width * height) {
    throw new Error("Motion detection scope size mismatch");
  }
  return { width, height, bits: table };
}

function buildScope(area: GridArea): Record<string, unknown> {
  if (area.bits.length !== area.width * area.height) {
    throw new Error("Grid area bitstring size mismatch");
  }
  return {
    width: area.width,
    height: area.height,
    cols: area.width,
    rows: area.height,
    table: area.bits,
  };
}

function normalizeAiArea(payload: AiAreaPayload): GridArea {
  const width = payload?.width ?? payload?.cols;
  const height = payload?.height ?? payload?.rows;
  const bits = payload?.area ?? payload?.table ?? payload?.bits;
  if (!width || !height || typeof bits !== "string") {
    throw new Error("Invalid AI detection area received from device");
  }
  if (bits.length !== width * height) {
    throw new Error("AI detection area size mismatch");
  }
  return { width, height, bits };
}

export class PresetsModule {
  private abilityCache: Map<number, Record<string, unknown>> = new Map();
  private aiSupportCache: Map<number, AiType[]> = new Map();

  constructor(private client: ReolinkClient) {}

  /**
   * List all PTZ presets for a channel
   * 
   * API: GetPtzPreset (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzPreset&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Array of preset objects with id (1-64), name, enable flag, and channel
   * 
   * @example
   * ```typescript
   * const presets = await module.listPresets(0);
   * // Returns: [{ id: 1, name: "Entrance", enable: true, channel: 0 }, ...]
   * ```
   * 
   * @see PTZ.md - GetPtzPreset section
   */
  async listPresets(channel: number): Promise<PtzPreset[]> {
    const response = await this.client.request<GetPtzPresetResponse>(
      "GetPtzPreset",
      { channel },
      1
    );

    // Debug: log the raw response to help diagnose issues
    const debug = (this.client as unknown as { debug?: boolean }).debug;
    if (debug) {
      console.error("[PresetsModule] Raw GetPtzPreset response:", JSON.stringify(response, null, 2));
    }

    // Handle null/undefined response
    if (!response) {
      if (debug) {
        console.warn("[PresetsModule] GetPtzPreset returned null/undefined response");
      }
      return [];
    }

    // Try multiple possible response structures
    // Expected format: { PtzPreset: { preset: [...] } }
    let rawPresets: PresetPayload[] | null = null;
    
    // Most common format: response.PtzPreset.preset (array)
    if (response?.PtzPreset && typeof response.PtzPreset === 'object' && !Array.isArray(response.PtzPreset)) {
      const ptzPreset = response.PtzPreset as { preset?: PresetPayload[] };
      if (ptzPreset.preset) {
        rawPresets = ptzPreset.preset;
      }
    }
    // Alternative: response.PtzPreset is directly an array
    else if (Array.isArray(response?.PtzPreset)) {
      rawPresets = response.PtzPreset;
    }
    // Alternative: response.preset (at root level)
    else if (response?.preset) {
      rawPresets = Array.isArray(response.preset) ? response.preset : [response.preset];
    }
    // Alternative: response.Presets (capitalized)
    else if (response?.Presets) {
      rawPresets = Array.isArray(response.Presets) ? response.Presets : [response.Presets];
    }
    // Alternative: response is directly an array
    else if (Array.isArray(response)) {
      rawPresets = response;
    }
    // Fallback: search for any array property that looks like presets
    else if (response && typeof response === 'object') {
      for (const key of Object.keys(response)) {
        const value = response[key];
        if (Array.isArray(value) && value.length > 0) {
          // Check if first element looks like a preset (has id property)
          const firstElement = value[0];
          if (firstElement && typeof firstElement === 'object' && ('id' in firstElement || 'ID' in firstElement)) {
            rawPresets = value as PresetPayload[];
            break;
          }
        }
        // Also check nested objects like { PtzPreset: { preset: [...] } }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const nestedValue = value as Record<string, unknown>;
          if ('preset' in nestedValue && Array.isArray(nestedValue.preset)) {
            rawPresets = nestedValue.preset as PresetPayload[];
            break;
          }
          if ('Preset' in nestedValue && Array.isArray(nestedValue.Preset)) {
            rawPresets = nestedValue.Preset as PresetPayload[];
            break;
          }
        }
      }
    }

    // Default to empty array if nothing found
    if (!rawPresets || !Array.isArray(rawPresets)) {
      // Log when we get unexpected response format (only if we got a response but couldn't parse it)
      if (response && typeof response === 'object' && Object.keys(response).length > 0) {
        console.warn("[PresetsModule] GetPtzPreset returned unexpected response format:", {
          channel,
          responseKeys: Object.keys(response || {}),
          rawPresetsType: typeof rawPresets,
          fullResponse: JSON.stringify(response, null, 2),
        });
      }
      rawPresets = [];
    }

    if (debug) {
      console.error(`[PresetsModule] Parsed ${rawPresets.length} presets from response`);
    }

    // Map presets, filtering out any invalid entries
    return rawPresets
      .filter((preset: PresetPayload) => preset != null && (preset.id != null || preset.ID != null))
      .map((preset: PresetPayload) => {
        const id = Number(preset.id ?? preset.ID ?? 0);
        const name = String(preset.name ?? preset.Name ?? `Preset ${id}`);
        const enable = preset.enable != null 
          ? Boolean(preset.enable === 1 || preset.enable === true) 
          : true; // Default to enabled if not specified
        const presetChannel = Number(preset.channel ?? preset.Channel ?? channel);
        
        return {
          id,
          name,
          enable,
          channel: presetChannel,
        };
      });
  }

  /**
   * Create or update a PTZ preset at the current camera position
   * 
   * API: SetPtzPreset (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetPtzPreset&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @param id - Preset ID (0-64, spec says 1-64 but some devices allow 0)
   * @param name - Preset name (up to 31 characters)
   * @param enable - Optional: Enable/disable the preset (default: enabled)
   * 
   * @example
   * ```typescript
   * // Save current position as preset 1
   * await module.setPreset(0, 1, "Front Door", true);
   * 
   * // Rename preset without changing enable state
   * await module.setPreset(0, 1, "Main Entrance");
   * ```
   * 
   * @throws Error if preset ID is out of range (0-64) or name exceeds 31 characters
   * @see PTZ.md - SetPtzPreset section
   */
  async setPreset(
    channel: number,
    id: PresetId,
    name: string,
    enable?: boolean
  ): Promise<void> {
    // Validate preset ID range (allow 0-64 for device compatibility)
    if (id < 0 || id > 64) {
      throw new Error(`Preset ID must be between 0 and 64, got: ${id}`);
    }
    
    // Validate preset name length per API spec
    if (name.length > 31) {
      throw new Error(`Preset name must not exceed 31 characters, got: ${name.length}`);
    }

    const payload = {
      PtzPreset: {
        channel,
        id,
        name,
        ...(enable === undefined ? {} : { enable: enable ? 1 : 0 }),
      },
    };

    await this.client.request("SetPtzPreset", payload);
  }

  /**
   * Move camera to a saved PTZ preset position
   * 
   * API: PtzCtrl with op="ToPos" (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=PtzCtrl&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @param id - Preset ID to move to (0-64, spec says 1-64 but some devices allow 0)
   * @param opts - Optional movement options
   * @param opts.speed - PTZ movement speed (1-64, model-dependent)
   * @param opts.settleMs - Milliseconds to wait after movement (default: 400ms)
   * 
   * @example
   * ```typescript
   * // Go to preset 5 at default speed
   * await module.gotoPreset(0, 5);
   * 
   * // Go to preset 3 at speed 32, wait 500ms for camera to settle
   * await module.gotoPreset(0, 3, { speed: 32, settleMs: 500 });
   * ```
   * 
   * @throws Error if preset ID is out of range (0-64)
   * @see PTZ.md - PtzCtrl section
   */
  async gotoPreset(
    channel: number,
    id: PresetId,
    opts: PtzMoveOptions = {}
  ): Promise<void> {
    // Validate preset ID range (allow 0-64 for device compatibility)
    if (id < 0 || id > 64) {
      throw new Error(`Preset ID must be between 0 and 64, got: ${id}`);
    }

    const speed = opts.speed !== undefined ? Math.max(1, Math.min(64, opts.speed)) : 32;
    const settleMs = opts.settleMs ?? DEFAULT_SETTLE_MS;

    // Per PTZ.md: ToPos requires id and optional speed parameter
    await this.client.request("PtzCtrl", {
      channel,
      op: "ToPos",
      id,
      speed,
    });

    if (settleMs > 0) {
      await delay(settleMs);
    }
  }

  /**
   * Get PTZ patrol route configurations
   * 
   * API: GetPtzPatrol (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzPatrol&token=...
   * 
   * Returns patrol definitions with sequences of presets, dwell times, and speeds.
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Patrol configuration object with preset array
   * 
   * @example
   * ```typescript
   * const patrol = await module.getPatrol(0);
   * // Returns: { PtzPatrol: [{ id: 1, enable: 1, preset: [...] }] }
   * ```
   * 
   * @see PTZ.md - GetPtzPatrol section
   */
  async getPatrol(channel: number): Promise<Record<string, unknown>> {
    return this.client.request("GetPtzPatrol", { channel }, 1);
  }

  /**
   * Define or modify a PTZ patrol route
   * 
   * API: SetPtzPatrol (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetPtzPatrol&token=...
   * 
   * Creates/updates a patrol sequence with up to 16 preset stops.
   * 
   * @param channel - Camera channel number (0-based)
   * @param payload - Patrol configuration object
   * @param payload.id - Patrol route ID (0-5)
   * @param payload.enable - Enable patrol (1) or disable (0)
   * @param payload.name - Optional patrol name
   * @param payload.preset - Array of preset stops with id, speed, dwellTime
   * 
   * @example
   * ```typescript
   * await module.setPatrol(0, {
   *   id: 1,
   *   enable: 1,
   *   name: "perimeter",
   *   preset: [
   *     { id: 1, speed: 10, dwellTime: 3 },
   *     { id: 2, speed: 20, dwellTime: 4 }
   *   ]
   * });
   * ```
   * 
   * @throws Error if patrol ID is out of range (0-5), preset array exceeds 16 steps, or preset IDs are invalid
   * @see PTZ.md - SetPtzPatrol section
   */
  async setPatrol(channel: number, payload: Record<string, unknown>): Promise<void> {
    // Validate patrol ID range per API spec (0-5)
    if (typeof payload.id === 'number' && (payload.id < 0 || payload.id > 5)) {
      throw new Error(`Patrol ID must be between 0 and 5, got: ${payload.id}`);
    }

    // Validate preset array length per API spec (max 16 steps)
    if (Array.isArray(payload.preset)) {
      if (payload.preset.length > 16) {
        throw new Error(`Patrol can have at most 16 preset steps, got: ${payload.preset.length}`);
      }

      // Validate each preset step
      payload.preset.forEach((step, index) => {
        if (typeof step === 'object' && step !== null) {
          const presetStep = step as { id?: number; speed?: number };
          
          // Validate preset ID (0-64, allowing 0 for device compatibility)
          if (typeof presetStep.id === 'number' && (presetStep.id < 0 || presetStep.id > 64)) {
            throw new Error(`Patrol step ${index}: preset ID must be between 0 and 64, got: ${presetStep.id}`);
          }

          // Validate speed (1-64)
          if (typeof presetStep.speed === 'number' && (presetStep.speed < 1 || presetStep.speed > 64)) {
            throw new Error(`Patrol step ${index}: speed must be between 1 and 64, got: ${presetStep.speed}`);
          }
        }
      });
    }

    await this.client.request("SetPtzPatrol", { 
      PtzPatrol: {
        channel,
        ...payload
      }
    });
  }

  /**
   * Get PTZ pattern/track definitions
   * 
   * API: GetPtzTattern (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzTattern&token=...
   * 
   * Note: The API uses "Tattern" (double 't') not "Pattern"
   * Retrieves PTZ trajectory/track routes (typically 1-6 tracks).
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Typed pattern configuration with track array
   * 
   * @example
   * ```typescript
   * const pattern = await module.getPattern(0);
   * // Fully typed response: PtzTatternResponse
   * if (pattern.PtzTattern?.track) {
   *   for (const track of pattern.PtzTattern.track) {
   *     console.log(`Track ${track.id}: ${track.name}, enabled: ${track.enable}`);
   *   }
   * }
   * ```
   * 
   * @see PTZ.md - GetPtzTattern section
   */
  async getPattern(channel: number): Promise<PtzTatternResponse> {
    return this.client.request("GetPtzTattern", { channel }, 1);
  }

  /**
   * Create or modify a PTZ pattern/track route
   * 
   * API: SetPtzTattern (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetPtzTattern&token=...
   * 
   * Note: The API uses "Tattern" (double 't') not "Pattern"
   * 
   * @param channel - Camera channel number (0-based)
   * @param payload - Pattern configuration
   * @param payload.track - Array of track definitions with id, name, enable
   * 
   * @example
   * ```typescript
   * await module.setPattern(0, {
   *   track: [{ id: 1, name: "patrol-path", enable: 1 }]
   * });
   * ```
   * 
   * @throws Error if track ID is out of range (1-6)
   * @see PTZ.md - SetPtzTattern section
   */
  async setPattern(channel: number, payload: Record<string, unknown>): Promise<void> {
    // Validate track array per API spec (IDs typically 1-6)
    if (Array.isArray(payload.track)) {
      payload.track.forEach((track, index) => {
        if (typeof track === 'object' && track !== null) {
          const trackItem = track as { id?: number };
          
          // Validate track ID (1-6)
          if (typeof trackItem.id === 'number' && (trackItem.id < 1 || trackItem.id > 6)) {
            throw new Error(`Track ${index}: track ID must be between 1 and 6, got: ${trackItem.id}`);
          }
        }
      });
    }

    await this.client.request("SetPtzTattern", payload ?? {});
  }

  /**
   * Read PTZ RS-485 serial configuration
   * 
   * API: GetPtzSerial (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzSerial&token=...
   * 
   * For cameras with serial PTZ domes connected via RS-485.
   * 
   * @param channel - Camera channel number (0-based)
   * @param action - 1 = return initial+range+value, 0 = value only (default: 1)
   * @returns Serial configuration with baudRate, protocol, dataBit, etc.
   * 
   * @example
   * ```typescript
   * const serial = await module.getPtzSerial(0);
   * // Returns: { PtzSerial: { baudRate: 9600, ctrlProtocol: "PELCO_D", ... } }
   * ```
   * 
   * @see PTZ.md - GetPtzSerial section
   */
  async getPtzSerial(channel: number, action: 0 | 1 = 1): Promise<Record<string, unknown>> {
    return this.client.request("GetPtzSerial", { channel }, action);
  }

  /**
   * Configure PTZ RS-485 serial parameters
   * 
   * API: SetPtzSerial (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetPtzSerial&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @param value - Serial configuration object
   * @param value.baudRate - Baud rate (e.g., 9600)
   * @param value.ctrlAddr - Control address
   * @param value.ctrlProtocol - Protocol: "PELCO_D" or "PELCO_P"
   * @param value.dataBit - Data bits: "CS8", "CS7", "CS6", or "CS5"
   * @param value.flowCtrl - Flow control: "none", "hard", "xon", or "xoff"
   * @param value.parity - Parity: "none", "odd", or "even"
   * @param value.stopBit - Stop bits: 1 or 2
   * 
   * @example
   * ```typescript
   * await module.setPtzSerial(0, {
   *   baudRate: 9600,
   *   ctrlAddr: 1,
   *   ctrlProtocol: "PELCO_D",
   *   dataBit: "CS8",
   *   flowCtrl: "none",
   *   parity: "none",
   *   stopBit: 1
   * });
   * ```
   * 
   * @see PTZ.md - SetPtzSerial section
   */
  async setPtzSerial(
    channel: number,
    value: {
      baudRate: number;
      ctrlAddr: number;
      ctrlProtocol: "PELCO_D" | "PELCO_P";
      dataBit: "CS8" | "CS7" | "CS6" | "CS5";
      flowCtrl: "none" | "hard" | "xon" | "xoff";
      parity: "none" | "odd" | "even";
      stopBit: 1 | 2;
    }
  ): Promise<void> {
    await this.client.request("SetPtzSerial", {
      PtzSerial: {
        channel,
        ...value,
      },
    });
  }

  /**
   * Read autofocus configuration
   * 
   * API: GetAutoFocus (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetAutoFocus&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @returns AutoFocus configuration with disable flag
   * 
   * @example
   * ```typescript
   * const af = await module.getAutoFocus(0);
   * // Returns: { AutoFocus: { disable: 0 } }
   * ```
   * 
   * @see PTZ.md - GetAutoFocus section
   */
  async getAutoFocus(channel: number): Promise<Record<string, unknown>> {
    return this.client.request("GetAutoFocus", { channel });
  }

  /**
   * Enable or disable autofocus
   * 
   * API: SetAutoFocus (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetAutoFocus&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @param payload - Configuration object
   * @param payload.disable - 1 to disable autofocus, 0 to enable
   * 
   * @example
   * ```typescript
   * // Disable autofocus
   * await module.setAutoFocus(0, { disable: 1 });
   * 
   * // Enable autofocus
   * await module.setAutoFocus(0, { disable: 0 });
   * ```
   * 
   * @see PTZ.md - SetAutoFocus section
   */
  async setAutoFocus(channel: number, payload: Record<string, unknown>): Promise<void> {
    await this.client.request("SetAutoFocus", {
      AutoFocus: {
        channel,
        ...(payload ?? {}),
      },
    });
  }

  /**
   * Read current zoom and focus positions
   * 
   * API: GetZoomFocus (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetZoomFocus&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Object with focus.pos and zoom.pos values
   * 
   * @example
   * ```typescript
   * const { focus, zoom } = await module.getZoomFocus(0);
   * console.log(`Focus: ${focus.pos}, Zoom: ${zoom.pos}`);
   * ```
   * 
   * @see PTZ.md - GetZoomFocus section
   */
  async getZoomFocus(
    channel: number
  ): Promise<{ focus: { pos: number }; zoom: { pos: number } }> {
    const response = await this.client.request<ZoomFocusResponse>("GetZoomFocus", { channel });
    const zoomFocus = response?.ZoomFocus ?? response;
    return {
      focus: { pos: Number(zoomFocus?.Focus?.pos ?? zoomFocus?.focus?.pos ?? 0) },
      zoom: { pos: Number(zoomFocus?.Zoom?.pos ?? zoomFocus?.zoom?.pos ?? 0) },
    };
  }

  /**
   * Perform zoom or focus operation
   * 
   * API: StartZoomFocus (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=StartZoomFocus&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @param op - Operation type
   *   - "ZoomPos": Move to absolute zoom position
   *   - "FocusPos": Move to absolute focus position
   *   - "ZoomInc": Zoom in
   *   - "ZoomDec": Zoom out
   *   - "FocusInc": Focus nearer
   *   - "FocusDec": Focus farther
   * @param pos - Optional absolute position for ZoomPos/FocusPos operations
   * 
   * @example
   * ```typescript
   * // Zoom to absolute position 6
   * await module.startZoomFocus(0, "ZoomPos", 6);
   * 
   * // Zoom in
   * await module.startZoomFocus(0, "ZoomInc");
   * ```
   * 
   * @see PTZ.md - StartZoomFocus section
   */
  async startZoomFocus(
    channel: number,
    op:
      | "ZoomPos"
      | "FocusPos"
      | "ZoomInc"
      | "ZoomDec"
      | "FocusInc"
      | "FocusDec",
    pos?: number
  ): Promise<void> {
    await this.client.request("StartZoomFocus", {
      ZoomFocus: {
        channel,
        op,
        ...(pos !== undefined ? { pos } : {}),
      },
    });
  }

  /**
   * Query PTZ guard (home) position configuration
   * 
   * API: GetPtzGuard (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzGuard&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Guard configuration
   *   - benable: 1 if auto-return enabled
   *   - bexistPos: 1 if guard position is configured
   *   - timeout: Seconds before auto-return (typically 60)
   * 
   * @example
   * ```typescript
   * const guard = await module.getGuard(0);
   * if (guard.benable === 1) {
   *   console.log(`Auto-return enabled, timeout: ${guard.timeout}s`);
   * }
   * ```
   * 
   * @see PTZ.md - GetPtzGuard section
   */
  async getGuard(
    channel: number
  ): Promise<{ benable: number; bexistPos: number; timeout: number }> {
    const response = await this.client.request<PtzGuardResponse>("GetPtzGuard", { channel });
    const guard = response?.PtzGuard ?? response;
    return {
      benable: Number(guard?.benable ?? 0),
      bexistPos: Number(guard?.bexistPos ?? guard?.bExistPos ?? 0),
      timeout: Number(guard?.timeout ?? 0),
    };
  }

  /**
   * Set or navigate to PTZ guard (home) position
   * 
   * API: SetPtzGuard (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=SetPtzGuard&token=...
   * 
   * Guard mode enables automatic return to a home position after inactivity.
   * Currently only supports 60-second timeout.
   * 
   * @param channel - Camera channel number (0-based)
   * @param options - Guard configuration
   * @param options.enable - Enable (true) or disable (false) auto-return
   * @param options.timeoutSec - Timeout in seconds (must be 60)
   * @param options.setCurrentAsGuard - Save current position as guard position
   * @param options.goToGuardNow - Immediately move to guard position
   * 
   * @example
   * ```typescript
   * // Set current position as guard, enable auto-return after 60s
   * await module.setGuard(0, {
   *   enable: true,
   *   timeoutSec: 60,
   *   setCurrentAsGuard: true
   * });
   * 
   * // Go to guard position now
   * await module.setGuard(0, { goToGuardNow: true });
   * ```
   * 
   * @throws Error if timeout is not 60 seconds
   * @see PTZ.md - SetPtzGuard section
   */
  async setGuard(channel: number, options: GuardOptions): Promise<void> {
    const timeout = options.timeoutSec ?? 60;
    if (timeout !== 60) {
      throw new Error("Reolink guard timeout currently supports only 60 seconds");
    }

    const payload = {
      PtzGuard: {
        channel,
        ...(options.enable === undefined ? {} : { benable: options.enable ? 1 : 0 }),
        ...(options.setCurrentAsGuard ? { bexistPos: 1 } : {}),
        timeout,
        cmdStr: options.goToGuardNow ? "toPos" : "setPos",
        bSaveCurrentPos: options.setCurrentAsGuard ? 1 : 0,
      },
    };

    await this.client.request("SetPtzGuard", payload);
  }

  /**
   * Check PTZ calibration status (NVR only)
   * 
   * API: GetPtzCheckState (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=GetPtzCheckState&token=...
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Calibration state
   *   - 0: Idle (not calibrating)
   *   - 1: Calibrating in progress
   *   - 2: Calibration finished
   * 
   * @example
   * ```typescript
   * const state = await module.getPtzCheckState(0);
   * if (state === 2) {
   *   console.log("PTZ calibration complete");
   * }
   * ```
   * 
   * @see PTZ.md - GetPtzCheckState section
   */
  async getPtzCheckState(channel: number): Promise<number> {
    const response = await this.client.request<PtzCheckStateResponse | number>("GetPtzCheckState", { channel });
    if (typeof response === "number") {
      return response;
    }
    if (typeof response?.state === "number") {
      return response.state;
    }
    if (typeof response?.PtzCheckState?.state === "number") {
      return response.PtzCheckState.state;
    }
    return Number(response ?? 0);
  }

  /**
   * Start PTZ calibration (NVR only)
   * 
   * API: PtzCheck (Reolink HTTP API v8)
   * Endpoint: POST /api.cgi?cmd=PtzCheck&token=...
   * 
   * Initiates PTZ calibration process. Use getPtzCheckState() to monitor progress.
   * 
   * @param channel - Camera channel number (0-based)
   * 
   * @example
   * ```typescript
   * await module.ptzCheck(0);
   * 
   * // Poll for completion
   * while (await module.getPtzCheckState(0) !== 2) {
   *   await new Promise(r => setTimeout(r, 1000));
   * }
   * ```
   * 
   * @see PTZ.md - PtzCheck section
   */
  async ptzCheck(channel: number): Promise<void> {
    await this.client.request("PtzCheck", { channel });
  }

  /**
   * Get motion detection zone grid
   * 
   * API: GetMdAlarm (Reolink HTTP API v8)
   * 
   * Retrieves the motion detection sensitivity grid as a bitstring.
   * 
   * @param channel - Camera channel number (0-based)
   * @returns GridArea with width, height, and bits (grid bitstring)
   * 
   * @example
   * ```typescript
   * const zone = await module.getMdZone(0);
   * console.log(`Grid: ${zone.width}x${zone.height}, bits: ${zone.bits.length}`);
   * ```
   */
  async getMdZone(channel: number): Promise<GridArea> {
    const response = await this.client.request<MdAlarmResponse>("GetMdAlarm", { channel });
    const mdAlarm = response?.MdAlarm ?? response?.Alarm ?? response;
    const scope = mdAlarm?.scope ?? mdAlarm?.Scope ?? mdAlarm;
    return normalizeMdScope(scope);
  }

  async setMdZone(channel: number, area: GridArea): Promise<void> {
    const scope = buildScope(area);
    let mdAlarmPayload: Record<string, unknown> = {
      channel,
      scope,
      table: area.bits,
    };

    try {
      const current = await this.client.request<MdAlarmResponse>("GetMdAlarm", { channel });
      const mdAlarm = current?.MdAlarm ?? current;
      if (mdAlarm && typeof mdAlarm === "object") {
        mdAlarmPayload = {
          ...mdAlarm,
          channel,
          scope: {
            ...(mdAlarm.scope ?? {}),
            ...scope,
          },
          table: area.bits,
        };
      }
    } catch (error) {
      if (error instanceof ReolinkHttpError) {
        throw error;
      }
      // Ignore inability to fetch current settings; fall back to minimal payload
    }

    await this.client.request("SetMdAlarm", {
      MdAlarm: mdAlarmPayload,
    });
  }

  /**
   * Get AI detection configuration
   * 
   * API: GetAiCfg (Reolink HTTP API v8)
   * 
   * @param channel - Optional channel number (0-based). Omit for device-wide config
   * @returns AI configuration object
   * 
   * @example
   * ```typescript
   * const aiCfg = await module.getAiCfg(0);
   * ```
   */
  async getAiCfg(channel?: number): Promise<Record<string, unknown>> {
    const payload = channel === undefined ? {} : { channel };
    const cfg = await this.client.request<AiCfgResponse>("GetAiCfg", payload, 1);
    return cfg?.AiCfg ?? cfg;
  }

  /**
   * Get AI detection zone for a specific AI type
   * 
   * API: GetAiAlarm (Reolink HTTP API v8)
   * 
   * @param channel - Camera channel number (0-based)
   * @param ai_type - AI detection type: "people", "vehicle", "dog_cat", or "face"
   * @returns GridArea with detection zone bitstring
   * 
   * @example
   * ```typescript
   * const peopleZone = await module.getAiZone(0, "people");
   * ```
   */
  async getAiZone(channel: number, ai_type: AiType): Promise<GridArea> {
    const response = await this.client.request<AiAlarmResponse>("GetAiAlarm", {
      channel,
      ai_type,
    });
    const aiAlarm = response?.AiAlarm ?? response;
    const scope = aiAlarm?.scope ?? aiAlarm?.Scope ?? aiAlarm;
    
    // Type guard to ensure scope is AiAreaPayload
    const scopePayload = scope as AiAreaPayload | undefined;
    const areaPayload = scopePayload?.area
      ? { width: scopePayload.width, height: scopePayload.height, area: scopePayload.area }
      : scopePayload;
    return normalizeAiArea(areaPayload as AiAreaPayload);
  }

  /**
   * Set AI detection zone for a specific AI type
   * 
   * API: SetAlarmArea (Reolink HTTP API v8)
   * 
   * @param channel - Camera channel number (0-based)
   * @param ai_type - AI detection type: "people", "vehicle", "dog_cat", or "face"
   * @param area - GridArea with width, height, and bits (zone bitstring)
   * 
   * @throws Error if AI type is unsupported or bitstring length mismatches
   * 
   * @example
   * ```typescript
   * await module.setAiZone(0, "people", {
   *   width: 80,
   *   height: 60,
   *   bits: "1".repeat(4800) // Full coverage
   * });
   * ```
   */
  async setAiZone(channel: number, ai_type: AiType, area: GridArea): Promise<void> {
    if (!SUPPORTED_AI_TYPES.includes(ai_type)) {
      throw new Error(`Unsupported AI type: ${ai_type}`);
    }
    if (area.bits.length !== area.width * area.height) {
      throw new Error("Invalid AI zone bitstring length");
    }
    await this.client.request("SetAlarmArea", {
      channel,
      ai_type,
      width: area.width,
      height: area.height,
      area: area.bits,
    });
  }

  /**
   * Get privacy mask areas
   * 
   * API: GetMask (Reolink HTTP API v8)
   * 
   * @param channel - Camera channel number (0-based)
   * @param action - 1 = return initial+range+value, 0 = value only (default: 1)
   * @returns Array of mask areas with screen dimensions and block coordinates
   * 
   * @example
   * ```typescript
   * const masks = await module.getMasks(0);
   * ```
   */
  async getMasks(
    channel: number,
    action: 0 | 1 = 1
  ): Promise<PresetZones["masks"]> {
    const response = await this.client.request<MaskResponse>("GetMask", { channel }, action);
    const mask = response?.Mask ?? response?.mask ?? response;
    // Type assertion needed for flexible response parsing
    const maskAny = mask as { area?: PresetZones["masks"]; areas?: PresetZones["masks"] };
    return maskAny?.area ?? maskAny?.areas ?? undefined;
  }

  /**
   * Set privacy mask areas
   * 
   * API: SetMask (Reolink HTTP API v8)
   * 
   * @param channel - Camera channel number (0-based)
   * @param masks - Array of mask areas to apply
   * @param enable - 1 to enable masks, 0 to disable
   * 
   * @example
   * ```typescript
   * await module.setMasks(0, [
   *   {
   *     screen: { width: 1920, height: 1080 },
   *     block: { x: 100, y: 100, width: 200, height: 150 }
   *   }
   * ], 1);
   * ```
   */
  async setMasks(
    channel: number,
    masks: NonNullable<PresetZones["masks"]>,
    enable: 0 | 1
  ): Promise<void> {
    await this.client.request("SetMask", {
      Mask: {
        channel,
        enable,
        area: masks,
      },
    });
  }

  /**
   * Apply detection zones and masks for a preset
   * 
   * Applies motion detection zones, AI detection zones, and privacy masks.
   * 
   * @param channel - Camera channel number (0-based)
   * @param presetId - Preset ID (1-64)
   * @param zones - Zone configuration with md, ai, and/or masks
   * 
   * @example
   * ```typescript
   * await module.applyZonesForPreset(0, 1, {
   *   md: { width: 80, height: 60, bits: "1".repeat(4800) },
   *   ai: {
   *     people: { width: 80, height: 60, bits: "1".repeat(4800) }
   *   }
   * });
   * ```
   */
  async applyZonesForPreset(
    channel: number,
    presetId: PresetId,
    zones: PresetZones
  ): Promise<void> {
    if (zones.masks) {
      await this.setMasks(channel, zones.masks, zones.masks.length > 0 ? 1 : 0);
    }

    if (zones.md) {
      await this.setMdZone(channel, zones.md);
    }

    if (zones.ai) {
      const entries = Object.entries(zones.ai) as Array<[AiType, GridArea | undefined]>;
      for (const [type, area] of entries) {
        if (!area) continue;
        await this.setAiZone(channel, type, area);
      }
    }
  }

  /**
   * Move to preset and apply associated detection zones
   * 
   * Combines preset navigation with zone application, useful for
   * maintaining different detection zones per preset position.
   * 
   * @param channel - Camera channel number (0-based)
   * @param presetId - Preset ID to move to (1-64)
   * @param zonesProvider - Async function that returns zones for the preset ID
   * @param opts - Optional movement options (speed, settleMs)
   * 
   * @example
   * ```typescript
   * await module.gotoPresetWithZones(
   *   0,
   *   5,
   *   async (id) => await database.getZonesForPreset(id),
   *   { speed: 32 }
   * );
   * ```
   */
  async gotoPresetWithZones(
    channel: number,
    presetId: PresetId,
    zonesProvider: (id: PresetId) => Promise<PresetZones | undefined>,
    opts: PtzMoveOptions = {}
  ): Promise<void> {
    await this.gotoPreset(channel, presetId, opts);
    const zones = await zonesProvider(presetId);
    if (zones) {
      await this.applyZonesForPreset(channel, presetId, zones);
    }
  }

  /**
   * Capture panoramic image by sweeping PTZ camera
   * 
   * Basic implementation: captures a single snapshot.
   * Future: Could sweep across pan/tilt steps and stitch tiles.
   * 
   * @param channel - Camera channel number (0-based)
   * @param plan - Panorama plan configuration
   * @param plan.panStep - Pan step size (degrees)
   * @param plan.tiltStep - Tilt step size (degrees)
   * @param plan.settleMs - Optional settle time per position
   * @param plan.maxTiles - Maximum tiles to capture (default: 16)
   * 
   * @returns Object with image buffer and tile count
   * 
   * @example
   * ```typescript
   * const pano = await module.buildPanorama(0, {
   *   panStep: 15,
   *   tiltStep: 10,
   *   maxTiles: 20
   * });
   * ```
   */
  async buildPanorama(
    channel: number,
    plan: PanoramaPlan
  ): Promise<{ image: CanvasResult; tiles: number }> {
    const maxTiles = plan.maxTiles ?? 16;
    if (maxTiles <= 0) {
      throw new Error("maxTiles must be positive for panorama plan");
    }

    // Basic implementation: capture a single snapshot as the panorama base.
    const buffer = await this.client.snapshotToBuffer(channel);
    return { image: buffer, tiles: 1 };
  }

  /**
   * Get device ability/capabilities for a specific channel
   * 
   * Internal helper that caches ability data to minimize API calls.
   * 
   * API: GetAbility (Reolink HTTP API v8)
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Ability object or null if unavailable
   * @private
   */
  private async getChannelAbility(channel: number): Promise<Record<string, unknown> | null> {
    if (this.abilityCache.has(channel)) {
      return this.abilityCache.get(channel) ?? null;
    }

    try {
      const response = await this.client.request<Record<string, unknown>>("GetAbility", {});
      const ability = response?.ability ?? response?.Ability ?? response;
      let channelAbility: Record<string, unknown> | null = null;

      if (Array.isArray((ability as { abilityChn?: unknown[] })?.abilityChn)) {
        const abilityChn = (ability as { abilityChn: Array<{ channel?: number }> }).abilityChn;
        channelAbility =
          abilityChn.find((item) => item?.channel === channel) ?? null;
      } else if ((ability as { abilityChn?: unknown })?.abilityChn && typeof (ability as { abilityChn: unknown }).abilityChn === "object") {
        const abilityChn = (ability as { abilityChn: Record<string, unknown> }).abilityChn;
        channelAbility = (abilityChn[channel] ?? abilityChn[`chn${channel}`] ?? null) as Record<string, unknown> | null;
      }

      this.abilityCache.set(channel, channelAbility ?? (ability as Record<string, unknown>) ?? {});
      return this.abilityCache.get(channel) ?? null;
    } catch (error) {
      this.abilityCache.set(channel, {});
      return null;
    }
  }

  /**
   * Detect which AI detection types are supported on a channel
   * 
   * Checks device abilities and AI configuration to determine
   * which AI types (people, vehicle, dog_cat, face) are available.
   * Results are cached per channel.
   * 
   * @param channel - Camera channel number (0-based)
   * @returns Array of supported AI types
   * 
   * @example
   * ```typescript
   * const types = await module.getSupportedAiTypes(0);
   * console.log(types); // ["people", "vehicle"]
   * ```
   */
  async getSupportedAiTypes(channel: number): Promise<AiType[]> {
    if (this.aiSupportCache.has(channel)) {
      return this.aiSupportCache.get(channel)!;
    }

    const supported = new Set<AiType>();

    try {
      const ability = await this.getChannelAbility(channel);
      const aiFlags = (
        ability?.supportAi ??
        ability?.supportAI ??
        ability?.ai ??
        ability?.AI ??
        ability
      ) as Record<string, unknown>;
      if (aiFlags && typeof aiFlags === "object") {
        for (const type of SUPPORTED_AI_TYPES) {
          const flag = aiFlags[type] ?? aiFlags[`support${type}`] ?? aiFlags[`support${type.toUpperCase()}`];
          if (flag === 1 || flag === true) {
            supported.add(type);
          }
        }
      }
    } catch (error) {
      // Ignore ability errors and fall back to GetAiCfg
    }

    if (supported.size === 0) {
      try {
        const cfg = await this.getAiCfg(channel);
        const info = (cfg?.ability ?? cfg?.Ability ?? cfg) as Record<string, unknown>;
        for (const type of SUPPORTED_AI_TYPES) {
          const flag = info?.[type];
          if (flag === 1 || flag === true) {
            supported.add(type);
          }
        }
      } catch (error) {
        // Ignore errors; fallback to empty set
      }
    }

    const result = Array.from(supported);
    this.aiSupportCache.set(channel, result);
    return result;
  }
}
