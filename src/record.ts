/**
 * Record search and download endpoints
 */

import { ReolinkClient } from "./reolink.js";

/**
 * Parameters for searching recorded video files
 * 
 * @property channel - Camera channel number (0-based)
 * @property start - Search start time as ISO 8601 timestamp (e.g., "2025-01-01T00:00:00Z")
 * @property end - Search end time as ISO 8601 timestamp
 * @property streamType - Stream quality: "main" for high quality, "sub" for lower quality (default: "main")
 */
export interface SearchParams {
  channel: number;
  start: string; // ISO 8601 timestamp
  end: string; // ISO 8601 timestamp
  streamType?: "main" | "sub";
}

/**
 * Information about a recorded video file
 * 
 * @property name - File name on the device
 * @property start - Recording start time
 * @property end - Recording end time
 */
export interface SearchFile {
  name: string;
  start: string;
  end: string;
  [key: string]: unknown;
}

/**
 * Response from search operation containing list of recordings
 * 
 * @property files - Array of found recording files
 */
export interface SearchResponse {
  files?: SearchFile[];
  [key: string]: unknown;
}

/**
 * Search for recorded files in a time range
 * 
 * Queries the device for video recordings within the specified time window.
 * Automatically converts ISO 8601 timestamps to Unix timestamps for the API.
 * 
 * @param client - An authenticated ReolinkClient instance
 * @param params - Search parameters
 * @returns Promise resolving to search results with array of found files
 * 
 * @throws {ReolinkHttpError} When the API request fails or returns an error
 * 
 * @example
 * ```typescript
 * const results = await search(client, {
 *   channel: 0,
 *   start: "2025-01-01T00:00:00Z",
 *   end: "2025-01-01T23:59:59Z",
 *   streamType: "main"
 * });
 * 
 * for (const file of results.files ?? []) {
 *   console.log(`Found recording: ${file.name} (${file.start} - ${file.end})`);
 * }
 * ```
 */
export async function search(
  client: ReolinkClient,
  params: SearchParams
): Promise<SearchResponse> {
  // Convert ISO timestamps to Unix timestamps
  const startTime = Math.floor(new Date(params.start).getTime() / 1000);
  const endTime = Math.floor(new Date(params.end).getTime() / 1000);

  const streamTypeNum = params.streamType === "sub" ? 1 : 0;

  return client.api<SearchResponse>("Search", {
    channel: params.channel,
    startTime,
    endTime,
    streamType: streamTypeNum,
  });
}

/**
 * Parameters for downloading a recorded file
 * 
 * @property channel - Camera channel number (0-based)
 * @property fileName - Name of the file to download (from search results)
 * @property streamType - Stream quality: "main" or "sub" (default: "main")
 */
export interface DownloadParams {
  channel: number;
  fileName: string;
  streamType?: "main" | "sub";
}

/**
 * Download a recorded file
 * 
 * Initiates download of a specific recording file from the device.
 * Use the search() function first to find available files.
 * 
 * Note: The exact behavior depends on the device implementation.
 * Some devices may return a download URL, while others may stream the file data.
 * 
 * @param client - An authenticated ReolinkClient instance
 * @param params - Download parameters
 * @returns Promise resolving to download response (URL or file data)
 * 
 * @throws {ReolinkHttpError} When the API request fails or returns an error
 * 
 * @example
 * ```typescript
 * // First, search for recordings
 * const results = await search(client, {
 *   channel: 0,
 *   start: "2025-01-01T00:00:00Z",
 *   end: "2025-01-01T23:59:59Z"
 * });
 * 
 * // Download the first file found
 * if (results.files && results.files.length > 0) {
 *   await download(client, {
 *     channel: 0,
 *     fileName: results.files[0].name,
 *     streamType: "main"
 *   });
 * }
 * ```
 */
export async function download(
  client: ReolinkClient,
  params: DownloadParams
): Promise<unknown> {
  const streamTypeNum = params.streamType === "sub" ? 1 : 0;

  return client.api("Download", {
    channel: params.channel,
    fileName: params.fileName,
    streamType: streamTypeNum,
  });
}

/**
 * NVR-specific download function
 * 
 * Alias for download() function. Use this when working with NVR devices
 * to maintain code clarity about the device type being used.
 * 
 * @param client - An authenticated ReolinkClient instance
 * @param params - Download parameters
 * @returns Promise resolving to download response
 * 
 * @example
 * ```typescript
 * await nvrDownload(client, {
 *   channel: 0,
 *   fileName: "rec_file.mp4",
 *   streamType: "main"
 * });
 * ```
 */
export async function nvrDownload(
  client: ReolinkClient,
  params: DownloadParams
): Promise<unknown> {
  return download(client, params);
}

