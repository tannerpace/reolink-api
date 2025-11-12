/**
 * Reolink API SDK
 * 
 * TypeScript SDK for Reolink camera and NVR devices.
 * 
 * @packageDocumentation
 * 
 * @example
 * ```typescript
 * import { ReolinkClient } from "reolink-nvr-api";
 * 
 * const client = new ReolinkClient({
 *   host: "192.168.1.100",
 *   username: "admin",
 *   password: "password"
 * });
 * 
 * await client.login();
 * const snapshot = await client.snapshotToBuffer(0);
 * await client.close();
 * ```
 */

export * from "./reolink.js";
export * from "./presets.js";
