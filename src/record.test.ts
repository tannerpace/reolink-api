/**
 * Unit tests for Record endpoints
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReolinkClient } from "./reolink.js";
import { search, download, nvrDownload } from "./record.js";

describe("Record endpoints", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: ReolinkClient;

  const createLoginResponse = () => ({
    ok: true,
    json: vi.fn().mockResolvedValue([
      {
        code: 0,
        value: {
          Token: { name: "test-token", leaseTime: 3600 },
        },
      },
    ]),
  });

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new ReolinkClient({
      host: "192.168.1.100",
      username: "admin",
      password: "password",
      fetch: mockFetch as unknown as typeof fetch,
    });
  });

  describe("search", () => {
    it("should search for recorded files with main stream", async () => {
      const searchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              SearchResult: {
                files: [
                  {
                    name: "Mp4Record 2025-01-01_10-00-00.mp4",
                    start: "2025-01-01T10:00:00Z",
                    end: "2025-01-01T10:30:00Z",
                  },
                ],
              },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(searchResponse);

      await client.login();
      const result = await search(client, {
        channel: 0,
        start: "2025-01-01T09:00:00Z",
        end: "2025-01-01T11:00:00Z",
      });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [, requestArgs] = mockFetch.mock.calls[1];
      const body = JSON.parse(String(requestArgs?.body ?? "[]"));
      expect(body[0].cmd).toBe("Search");
      expect(body[0].param).toHaveProperty("channel", 0);
      expect(body[0].param).toHaveProperty("startTime");
      expect(body[0].param).toHaveProperty("endTime");
      expect(body[0].param).toHaveProperty("streamType", 0); // main stream
    });

    it("should search for recorded files with sub stream", async () => {
      const searchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { SearchResult: { files: [] } },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(searchResponse);

      await client.login();
      await search(client, {
        channel: 1,
        start: "2025-01-01T09:00:00Z",
        end: "2025-01-01T11:00:00Z",
        streamType: "sub",
      });

      const [, requestArgs] = mockFetch.mock.calls[1];
      const body = JSON.parse(String(requestArgs?.body ?? "[]"));
      expect(body[0].param).toHaveProperty("streamType", 1); // sub stream
    });

    it("should convert ISO timestamps to Unix timestamps", async () => {
      const searchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { SearchResult: { files: [] } },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(searchResponse);

      await client.login();
      await search(client, {
        channel: 0,
        start: "2025-01-01T00:00:00Z",
        end: "2025-01-01T23:59:59Z",
      });

      const [, requestArgs] = mockFetch.mock.calls[1];
      const body = JSON.parse(String(requestArgs?.body ?? "[]"));
      
      // Check that timestamps are Unix timestamps (numbers)
      expect(typeof body[0].param.startTime).toBe("number");
      expect(typeof body[0].param.endTime).toBe("number");
      expect(body[0].param.startTime).toBeLessThan(body[0].param.endTime);
    });
  });

  describe("download", () => {
    it("should download a recorded file with main stream", async () => {
      const downloadResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { url: "https://example.com/download/file.mp4" },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(downloadResponse);

      await client.login();
      const result = await download(client, {
        channel: 0,
        fileName: "Mp4Record 2025-01-01_10-00-00.mp4",
      });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [, requestArgs] = mockFetch.mock.calls[1];
      const body = JSON.parse(String(requestArgs?.body ?? "[]"));
      expect(body[0].cmd).toBe("Download");
      expect(body[0].param).toEqual({
        channel: 0,
        fileName: "Mp4Record 2025-01-01_10-00-00.mp4",
        streamType: 0,
      });
    });

    it("should download a recorded file with sub stream", async () => {
      const downloadResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { url: "https://example.com/download/file.mp4" },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(downloadResponse);

      await client.login();
      await download(client, {
        channel: 1,
        fileName: "test.mp4",
        streamType: "sub",
      });

      const [, requestArgs] = mockFetch.mock.calls[1];
      const body = JSON.parse(String(requestArgs?.body ?? "[]"));
      expect(body[0].param).toHaveProperty("streamType", 1);
    });
  });

  describe("nvrDownload", () => {
    it("should delegate to download function", async () => {
      const downloadResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { url: "https://example.com/download/nvr-file.mp4" },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(downloadResponse);

      await client.login();
      const result = await nvrDownload(client, {
        channel: 0,
        fileName: "nvr-recording.mp4",
      });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
