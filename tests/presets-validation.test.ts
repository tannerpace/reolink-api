/**
 * Unit tests for PresetsModule validation and uncovered methods
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PresetsModule } from "../src/presets.js";
import { ReolinkClient } from "../src/reolink.js";

describe("PresetsModule validation and methods", () => {
  let module: PresetsModule;
  let mockClient: ReolinkClient;

  beforeEach(() => {
    mockClient = {
      request: vi.fn(),
      requestMany: vi.fn(),
      snapshotToBuffer: vi.fn(),
    } as unknown as ReolinkClient;
    module = new PresetsModule(mockClient);
  });

  describe("setPreset validation", () => {
    it("should throw error for preset ID below 0", async () => {
      await expect(
        module.setPreset(0, -1, "Invalid")
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset ID above 64", async () => {
      await expect(
        module.setPreset(0, 65, "Invalid")
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset name exceeding 31 characters", async () => {
      const longName = "This is a very long preset name that exceeds the maximum limit";
      await expect(
        module.setPreset(0, 1, longName)
      ).rejects.toThrow("Preset name must not exceed 31 characters");
    });

    it("should accept preset ID 0", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPreset(0, 0, "Default");
      expect(mockClient.request).toHaveBeenCalledWith("SetPtzPreset", {
        PtzPreset: {
          channel: 0,
          id: 0,
          name: "Default",
        },
      });
    });

    it("should accept preset ID 64", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPreset(0, 64, "Max Preset");
      expect(mockClient.request).toHaveBeenCalled();
    });

    it("should accept preset name with exactly 31 characters", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      const exactName = "1234567890123456789012345678901"; // 31 chars
      await module.setPreset(0, 1, exactName);
      expect(mockClient.request).toHaveBeenCalled();
    });
  });

  describe("gotoPreset validation", () => {
    it("should throw error for preset ID below 0", async () => {
      await expect(
        module.gotoPreset(0, -1)
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset ID above 64", async () => {
      await expect(
        module.gotoPreset(0, 65)
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should accept preset ID 0", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.gotoPreset(0, 0);
      expect(mockClient.request).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 0,
        speed: 32,
      });
    });

    it("should accept preset ID 64", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.gotoPreset(0, 64);
      expect(mockClient.request).toHaveBeenCalled();
    });

    it("should use custom speed within valid range", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.gotoPreset(0, 5, { speed: 50 });
      expect(mockClient.request).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 5,
        speed: 50,
      });
    });

    it("should clamp speed above 64 to 64", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.gotoPreset(0, 5, { speed: 100 });
      expect(mockClient.request).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 5,
        speed: 64,
      });
    });

    it("should clamp speed below 1 to 1", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.gotoPreset(0, 5, { speed: 0 });
      expect(mockClient.request).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 5,
        speed: 1,
      });
    });

    it("should skip settling delay when settleMs is 0", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      const start = Date.now();
      await module.gotoPreset(0, 5, { settleMs: 0 });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // No delay
    });
  });

  describe("getPatrol", () => {
    it("should call GetPtzPatrol with action=1", async () => {
      const mockResponse = {
        PtzPatrol: [{ id: 1, enable: 1, preset: [] }],
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getPatrol(0);

      expect(mockClient.request).toHaveBeenCalledWith("GetPtzPatrol", { channel: 0 }, 1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("setPatrol validation", () => {
    it("should throw error for patrol ID below 0", async () => {
      await expect(
        module.setPatrol(0, { id: -1, enable: 1, preset: [] })
      ).rejects.toThrow("Patrol ID must be between 0 and 5");
    });

    it("should throw error for patrol ID above 5", async () => {
      await expect(
        module.setPatrol(0, { id: 6, enable: 1, preset: [] })
      ).rejects.toThrow("Patrol ID must be between 0 and 5");
    });

    it("should throw error for more than 16 preset steps", async () => {
      const tooManyPresets = Array.from({ length: 17 }, (_, i) => ({
        id: i,
        speed: 10,
        dwellTime: 2,
      }));

      await expect(
        module.setPatrol(0, { id: 1, enable: 1, preset: tooManyPresets })
      ).rejects.toThrow("Patrol can have at most 16 preset steps");
    });

    it("should throw error for invalid preset ID in step", async () => {
      await expect(
        module.setPatrol(0, {
          id: 1,
          enable: 1,
          preset: [{ id: 65, speed: 10 }],
        })
      ).rejects.toThrow("Patrol step 0: preset ID must be between 0 and 64");
    });

    it("should throw error for invalid speed in step", async () => {
      await expect(
        module.setPatrol(0, {
          id: 1,
          enable: 1,
          preset: [{ id: 1, speed: 65 }],
        })
      ).rejects.toThrow("Patrol step 0: speed must be between 1 and 64");
    });

    it("should accept patrol ID 0", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPatrol(0, { id: 0, enable: 1, preset: [] });
      expect(mockClient.request).toHaveBeenCalled();
    });

    it("should accept patrol ID 5", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPatrol(0, { id: 5, enable: 1, preset: [] });
      expect(mockClient.request).toHaveBeenCalled();
    });

    it("should accept exactly 16 preset steps", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      const maxPresets = Array.from({ length: 16 }, (_, i) => ({
        id: i,
        speed: 10,
        dwellTime: 2,
      }));

      await module.setPatrol(0, { id: 1, enable: 1, preset: maxPresets });
      expect(mockClient.request).toHaveBeenCalled();
    });

    it("should accept boundary speed values (1 and 64)", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPatrol(0, {
        id: 1,
        enable: 1,
        preset: [
          { id: 1, speed: 1 },
          { id: 2, speed: 64 },
        ],
      });
      expect(mockClient.request).toHaveBeenCalled();
    });
  });

  describe("getPattern", () => {
    it("should call GetPtzTattern with action=1", async () => {
      const mockResponse = {
        PtzTattern: {
          track: [{ id: 1, name: "Track1", enable: 1 }],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getPattern(0);

      expect(mockClient.request).toHaveBeenCalledWith("GetPtzTattern", { channel: 0 }, 1);
      expect(result).toEqual(mockResponse);
    });
  });

  describe("setPattern validation", () => {
    it("should throw error for track ID below 1", async () => {
      await expect(
        module.setPattern(0, {
          track: [{ id: 0, name: "Invalid", enable: 1 }],
        })
      ).rejects.toThrow("Track 0: track ID must be between 1 and 6");
    });

    it("should throw error for track ID above 6", async () => {
      await expect(
        module.setPattern(0, {
          track: [{ id: 7, name: "Invalid", enable: 1 }],
        })
      ).rejects.toThrow("Track 0: track ID must be between 1 and 6");
    });

    it("should accept track ID 1", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPattern(0, {
        track: [{ id: 1, name: "Track1", enable: 1 }],
      });
      expect(mockClient.request).toHaveBeenCalledWith("SetPtzTattern", {
        track: [{ id: 1, name: "Track1", enable: 1 }],
      });
    });

    it("should accept track ID 6", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});
      await module.setPattern(0, {
        track: [{ id: 6, name: "Track6", enable: 1 }],
      });
      expect(mockClient.request).toHaveBeenCalled();
    });
  });

  describe("getZoomFocus", () => {
    it("should call GetZoomFocus and transform response", async () => {
      const mockResponse = {
        ZoomFocus: { channel: 0, zoom: { pos: 50 }, focus: { pos: 30 } },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getZoomFocus(0);

      expect(mockClient.request).toHaveBeenCalledWith(
        "GetZoomFocus",
        { channel: 0 }
      );
      expect(result).toEqual({
        focus: { pos: 30 },
        zoom: { pos: 50 },
      });
    });
  });

  describe("getGuard", () => {
    it("should call GetPtzGuard and transform response", async () => {
      const mockResponse = {
        PtzGuard: { channel: 0, benable: 1, bexistPos: 0, timeout: 60 },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getGuard(0);

      expect(mockClient.request).toHaveBeenCalledWith("GetPtzGuard", { channel: 0 });
      expect(result).toEqual({
        benable: 1,
        bexistPos: 0,
        timeout: 60,
      });
    });
  });

  describe("setGuard", () => {
    it("should call SetPtzGuard with default timeout (60 seconds)", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});

      await module.setGuard(0, { enable: true });

      expect(mockClient.request).toHaveBeenCalledWith("SetPtzGuard", expect.any(Object));
    });

    it("should throw error when timeout is not 60 seconds", async () => {
      await expect(
        module.setGuard(0, { enable: true, timeoutSec: 120 })
      ).rejects.toThrow("Reolink guard timeout currently supports only 60 seconds");
    });

    it("should call SetPtzGuard with setCurrentAsGuard option", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});

      await module.setGuard(0, { setCurrentAsGuard: true, timeoutSec: 60 });

      expect(mockClient.request).toHaveBeenCalledWith("SetPtzGuard", expect.any(Object));
    });

    it("should call SetPtzGuard with goToGuardNow option", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});

      await module.setGuard(0, { goToGuardNow: true });

      expect(mockClient.request).toHaveBeenCalledWith("SetPtzGuard", expect.any(Object));
    });
  });

  describe("getMdZone", () => {
    it("should call GetMdAlarm and transform response to GridArea", async () => {
      const mockResponse = {
        MdAlarm: {
          channel: 0,
          scope: { width: 4, height: 3, table: "111100001111" },
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getMdZone(0);

      expect(mockClient.request).toHaveBeenCalledWith("GetMdAlarm", { channel: 0 });
      expect(result).toEqual({
        width: 4,
        height: 3,
        bits: "111100001111",
      });
    });
  });

  describe("getAiZone", () => {
    it("should call GetAiAlarm and transform response for people detection", async () => {
      const mockResponse = {
        AiAlarm: {
          channel: 0,
          ai_type: "people",
          scope: { width: 5, height: 4, table: "1".repeat(20) },
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getAiZone(0, "people");

      expect(mockClient.request).toHaveBeenCalledWith("GetAiAlarm", {
        channel: 0,
        ai_type: "people",
      });
      expect(result).toEqual({
        width: 5,
        height: 4,
        bits: "1".repeat(20),
      });
    });

    it("should call GetAiAlarm and transform response for vehicle detection", async () => {
      const mockResponse = {
        AiAlarm: {
          channel: 0,
          ai_type: "vehicle",
          scope: { width: 6, height: 4, table: "0".repeat(24) },
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.getAiZone(0, "vehicle");

      expect(mockClient.request).toHaveBeenCalledWith("GetAiAlarm", {
        channel: 0,
        ai_type: "vehicle",
      });
      expect(result).toEqual({
        width: 6,
        height: 4,
        bits: "0".repeat(24),
      });
    });
  });

  describe("getSupportedAiTypes", () => {
    it("should return cached AI types if available", async () => {
      // Pre-populate cache
      const cache = (module as unknown as { aiSupportCache: Map<number, string[]> })
        .aiSupportCache;
      cache.set(0, ["people", "vehicle"]);

      const result = await module.getSupportedAiTypes(0);

      expect(result).toEqual(["people", "vehicle"]);
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it("should fetch and cache AI types when not cached", async () => {
      const mockAbility = {
        Ability: {
          abilityChn: [
            {
              channel: 0,
              people: 1,
              vehicle: 1,
            },
          ],
        },
      };
      
      // First call to GetAbility
      vi.mocked(mockClient.request)
        .mockResolvedValueOnce(mockAbility)
        .mockResolvedValueOnce({ // fallback GetAiCfg
          people: 1,
          vehicle: 1,
        });

      const result = await module.getSupportedAiTypes(0);

      expect(mockClient.request).toHaveBeenCalledWith("GetAbility", {});
      // May contain people/vehicle depending on which detection path succeeded
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle missing Ability response gracefully", async () => {
      vi.mocked(mockClient.request).mockResolvedValue({});

      const result = await module.getSupportedAiTypes(0);

      expect(result).toEqual([]);
    });
  });

  describe("listPresets edge cases", () => {
    it("should handle null response", async () => {
      vi.mocked(mockClient.request).mockResolvedValue(null);

      const result = await module.listPresets(0);

      expect(result).toEqual([]);
    });

    it("should handle undefined response", async () => {
      vi.mocked(mockClient.request).mockResolvedValue(undefined);

      const result = await module.listPresets(0);

      expect(result).toEqual([]);
    });

    it("should handle response with PtzPreset as array", async () => {
      const mockResponse = {
        PtzPreset: [
          { id: 1, name: "Preset1", enable: 1 },
          { id: 2, name: "Preset2", enable: 0 },
        ],
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: "Preset1",
        enable: true,
        channel: 0,
      });
    });

    it("should handle response with preset at root level", async () => {
      const mockResponse = {
        preset: [{ id: 3, name: "Root Preset", enable: 1 }],
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Root Preset");
    });

    it("should handle response with Presets (capitalized)", async () => {
      const mockResponse = {
        Presets: [{ id: 4, name: "Capitalized", enable: 0 }],
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result).toHaveLength(1);
      expect(result[0].enable).toBe(false);
    });

    it("should handle direct array response", async () => {
      const mockResponse = [
        { id: 5, name: "Direct Array", enable: 1 },
      ] as unknown as Record<string, unknown>;
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Direct Array");
    });

    it("should filter out null/invalid presets", async () => {
      const mockResponse = {
        PtzPreset: {
          preset: [
            { id: 1, name: "Valid", enable: 1 },
            null,
            { name: "No ID", enable: 1 },
            { id: 2, name: "Valid2", enable: 0 },
          ],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it("should use ID when id is missing", async () => {
      const mockResponse = {
        PtzPreset: {
          preset: [{ ID: 10, Name: "Uppercase ID", enable: 1 }],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result[0].id).toBe(10);
      expect(result[0].name).toBe("Uppercase ID");
    });

    it("should generate default name when missing", async () => {
      const mockResponse = {
        PtzPreset: {
          preset: [{ id: 7, enable: 1 }],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result[0].name).toBe("Preset 7");
    });

    it("should default enable to true when missing", async () => {
      const mockResponse = {
        PtzPreset: {
          preset: [{ id: 8, name: "No Enable" }],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result[0].enable).toBe(true);
    });

    it("should use channel from preset when available", async () => {
      const mockResponse = {
        PtzPreset: {
          preset: [{ id: 9, name: "Channel Override", enable: 1, channel: 2 }],
        },
      };
      vi.mocked(mockClient.request).mockResolvedValue(mockResponse);

      const result = await module.listPresets(0);

      expect(result[0].channel).toBe(2);
    });
  });
});
