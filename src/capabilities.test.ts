/**
 * Unit tests for Capabilities detection
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReolinkClient } from "./reolink.js";
import {
  detectCapabilities,
  requireCapability,
  checkFeature,
} from "./capabilities.js";

describe("Capabilities", () => {
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

  describe("detectCapabilities", () => {
    it("should detect PTZ capability", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Ptz: { ver: 1, permit: 7 },
              User: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.ptz).toBe(true);
    });

    it("should detect AI capability with AI key", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              AI: { ver: 1, permit: 7 },
              User: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.ai).toBe(true);
    });

    it("should detect AI capability with Person key", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Person: { ver: 1, permit: 7 },
              User: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.ai).toBe(true);
    });

    it("should detect motion detection capability", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Md: { ver: 1, permit: 7 },
              User: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.motionDetection).toBe(true);
    });

    it("should detect recording capability", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Rec: { ver: 1, permit: 7 },
              User: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.recording).toBe(true);
    });

    it("should detect multiple capabilities", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Ptz: { ver: 1 },
              AI: { ver: 1 },
              Md: { ver: 1 },
              Rec: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.ptz).toBe(true);
      expect(caps.ai).toBe(true);
      expect(caps.motionDetection).toBe(true);
      expect(caps.recording).toBe(true);
    });

    it("should handle lowercase capability keys", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              ptz: { ver: 1 },
              ai: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps.ptz).toBe(true);
      expect(caps.ai).toBe(true);
    });

    it("should return empty capabilities on API error", async () => {
      const errorResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 1,
            error: {
              rspCode: -1,
              detail: "Command failed",
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(errorResponse);

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps).toEqual({});
    });

    it("should return empty capabilities on network error", async () => {
      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await client.login();
      const caps = await detectCapabilities(client);

      expect(caps).toEqual({});
    });
  });

  describe("requireCapability", () => {
    it("should not throw if capability exists", () => {
      const caps = { ptz: true, ai: true };

      expect(() => requireCapability(caps, "ptz")).not.toThrow();
      expect(() => requireCapability(caps, "ai")).not.toThrow();
    });

    it("should throw if capability does not exist", () => {
      const caps = { ptz: true };

      expect(() => requireCapability(caps, "ai")).toThrow(
        "Feature 'ai' is not supported on this device"
      );
    });

    it("should list available capabilities in error message", () => {
      const caps = { ptz: true, recording: true };

      try {
        requireCapability(caps, "ai");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("ptz, recording");
      }
    });

    it("should handle undefined capability value", () => {
      const caps = { ptz: undefined };

      expect(() => requireCapability(caps, "ptz")).toThrow();
    });

    it("should handle false capability value", () => {
      const caps = { ptz: false };

      expect(() => requireCapability(caps, "ptz")).toThrow();
    });
  });

  describe("checkFeature", () => {
    it("should return true if feature is supported", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Ptz: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const hasPtz = await checkFeature(client, "ptz");

      expect(hasPtz).toBe(true);
    });

    it("should return false if feature is not supported", async () => {
      const abilityResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 0,
            value: {
              Rec: { ver: 1 },
            },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(abilityResponse);

      await client.login();
      const hasPtz = await checkFeature(client, "ptz");

      expect(hasPtz).toBe(false);
    });

    it("should return false on API error", async () => {
      const errorResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            code: 1,
            error: { rspCode: -1 },
          },
        ]),
      };

      mockFetch.mockResolvedValueOnce(createLoginResponse());
      mockFetch.mockResolvedValueOnce(errorResponse);

      await client.login();
      const hasPtz = await checkFeature(client, "ptz");

      expect(hasPtz).toBe(false);
    });
  });
});
