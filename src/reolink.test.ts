/**
 * Unit tests for ReolinkClient
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReolinkClient } from "./reolink.js";
import { ReolinkHttpError } from "./types.js";

describe("ReolinkClient", () => {
  const mockFetch = vi.fn();
  const mockOptions = {
    host: "192.168.1.100",
    username: "admin",
    password: "password",
    fetch: mockFetch as unknown as typeof fetch,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should login successfully and return token", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token-123",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const client = new ReolinkClient(mockOptions);
      const token = await client.login();

      expect(token).toBe("test-token-123");
      expect(client.getToken()).toBe("test-token-123");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should throw error on login failure", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 1,
            error: {
              rspCode: -1,
              detail: "Invalid credentials",
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const client = new ReolinkClient(mockOptions);

      await expect(client.login()).rejects.toThrow(ReolinkHttpError);
    });
  });

  describe("api", () => {
    it("should make API call successfully", async () => {
      // Mock login
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      // Mock API call
      const apiResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { result: "success" },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();
      const result = await client.api("GetDevInfo");

      expect(result).toEqual({ result: "success" });
    });

    it("should throw ReolinkHttpError on API error", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const apiErrorResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 1,
            error: {
              rspCode: -2,
              detail: "Command not supported",
            },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiErrorResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();

      await expect(client.api("InvalidCommand")).rejects.toThrow(
        ReolinkHttpError
      );
    });

    it("should retry on token error", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const tokenErrorResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 1,
            error: {
              rspCode: -1,
              detail: "Invalid token",
            },
          },
        ]),
      };

      const successResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { result: "success after retry" },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse) // Initial login
        .mockResolvedValueOnce(tokenErrorResponse) // Token error
        .mockResolvedValueOnce(loginResponse) // Re-login
        .mockResolvedValueOnce(successResponse); // Retry success

      const client = new ReolinkClient(mockOptions);
      await client.login();
      const result = await client.api("GetDevInfo");

      expect(result).toEqual({ result: "success after retry" });
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("requestMany", () => {
    it("should handle multiple requests successfully", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const batchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { name: "Device1" },
          },
          {
            code: 0,
            value: { channel: 0 },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(batchResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();

      const results = await client.requestMany([
        { cmd: "GetDevInfo" },
        { cmd: "GetEnc", param: { channel: 0 } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ name: "Device1" });
      expect(results[1]).toEqual({ channel: 0 });
    });

    it("should throw error for failed request in batch", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const batchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { name: "Device1" },
          },
          {
            code: 1,
            error: {
              rspCode: -9,
              detail: "Not supported",
            },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(batchResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();

      await expect(
        client.requestMany([
          { cmd: "GetDevInfo" },
          { cmd: "GetUnsupported" },
        ])
      ).rejects.toThrow(ReolinkHttpError);
    });

    it("should return empty array for empty request list", async () => {
      const client = new ReolinkClient(mockOptions);
      const results = await client.requestMany([]);
      expect(results).toEqual([]);
    });
  });

  describe("request (alias)", () => {
    it("should work as alias for api", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const apiResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { result: "success" },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(apiResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();
      const result = await client.request("GetDevInfo", {}, 0);

      expect(result).toEqual({ result: "success" });
    });
  });

  describe("getter methods", () => {
    it("should return host", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.getHost()).toBe("192.168.1.100");
    });

    it("should return username", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.getUsername()).toBe("admin");
    });

    it("should return password", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.getPassword()).toBe("password");
    });

    it("should return mode", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.getMode()).toBe("long");
    });

    it("should return insecure status", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.isInsecure()).toBe(true);
    });

    it("should return fetch implementation", () => {
      const client = new ReolinkClient(mockOptions);
      expect(client.getFetchImpl()).toBe(mockFetch);
    });
  });

  describe("short mode", () => {
    it("should work in short mode without token", async () => {
      const shortModeOptions = {
        ...mockOptions,
        mode: "short" as const,
      };

      const apiResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: { result: "success" },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(apiResponse);

      const client = new ReolinkClient(shortModeOptions);
      const result = await client.api("GetDevInfo");

      expect(result).toEqual({ result: "success" });
      // Should not call login in short mode
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("should logout and close client", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const logoutResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([{ code: 0, value: {} }]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(logoutResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();
      await client.close();

      expect(client.isClosed()).toBe(true);
    });

    it("should be idempotent", async () => {
      const client = new ReolinkClient({
        ...mockOptions,
        mode: "short", // Use short mode to avoid login/logout complexity
      });

      await client.close();
      await client.close(); // Second close should be safe

      expect(client.isClosed()).toBe(true);
    });

    it("should stop event emitters on close", async () => {
      const client = new ReolinkClient({
        ...mockOptions,
        mode: "short", // Use short mode to avoid login complexity
      });

      const emitter = client.createEventEmitter({ channels: [0] });
      emitter.start();

      expect(emitter.isActive()).toBe(true);

      await client.close();

      expect(emitter.isActive()).toBe(false);
    });
  });

  describe("createEventEmitter", () => {
    it("should create event emitter", async () => {
      const client = new ReolinkClient(mockOptions);
      const emitter = client.createEventEmitter({ interval: 1000 });

      expect(emitter).toBeDefined();
      expect(emitter.isActive()).toBe(false);
    });
  });

  describe("snapshot methods", () => {
    it("should call snapshotToBuffer", async () => {
      // Use short mode to simplify the test
      const shortModeClient = new ReolinkClient({
        ...mockOptions,
        mode: "short",
      });

      // Mock JPEG response - create proper ArrayBuffer
      const jpegArray = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const snapshotResponse = {
        ok: true,
        arrayBuffer: () => Promise.resolve(jpegArray.buffer),
      };

      mockFetch.mockResolvedValueOnce(snapshotResponse);

      const buffer = await shortModeClient.snapshotToBuffer(0);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer[0]).toBe(0xff);
      expect(buffer[1]).toBe(0xd8);
    });
  });

  describe("createPlaybackController", () => {
    it("should create playback controller", () => {
      const client = new ReolinkClient(mockOptions);
      const controller = client.createPlaybackController();

      expect(controller).toBeDefined();
      expect(controller.getClient()).toBe(client);
    });
  });

  describe("PTZ methods", () => {
    it("should call getPtzGuard", async () => {
      const loginResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Token: {
                name: "test-token",
                leaseTime: 3600,
              },
            },
          },
        ]),
      };

      const guardResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              PtzGuard: {
                benable: 1,
                timeout: 60,
              },
            },
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(loginResponse)
        .mockResolvedValueOnce(guardResponse);

      const client = new ReolinkClient(mockOptions);
      await client.login();
      const guard = await client.getPtzGuard(0);

      expect(guard).toHaveProperty("benable");
      expect(guard).toHaveProperty("timeout");
    });
  });
});

