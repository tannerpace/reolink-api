/**
 * Unit tests for PTZ preset and control functionality
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPtzPreset,
  setPtzPreset,
  ptzCtrl,
} from "./ptz.js";
import { ReolinkClient } from "./reolink.js";

describe("PTZ Preset and Control", () => {
  let mockClient: ReolinkClient;

  beforeEach(() => {
    mockClient = {
      api: vi.fn(),
    } as unknown as ReolinkClient;
  });

  describe("getPtzPreset", () => {
    it("should call GetPtzPreset and normalize response with PtzPreset", async () => {
      const mockResponse = {
        PtzPreset: [
          { id: 1, name: "Entrance", enable: 1 },
          { id: 2, name: "Parking", enable: 1 },
        ],
      };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      const result = await getPtzPreset(mockClient, 0);

      expect(mockClient.api).toHaveBeenCalledWith("GetPtzPreset", {
        channel: 0,
      });
      expect(result).toHaveProperty("PtzPreset");
      expect(result).toHaveProperty("preset");
      expect(result.preset).toEqual(mockResponse.PtzPreset);
    });

    it("should normalize response when only preset field exists", async () => {
      const mockResponse = {
        preset: [
          { id: 1, name: "Front Door", enable: 1 },
        ],
      };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      const result = await getPtzPreset(mockClient, 0);

      expect(result).toHaveProperty("preset");
      expect(result.preset).toEqual(mockResponse.preset);
    });
  });

  describe("setPtzPreset", () => {
    it("should call SetPtzPreset with all parameters", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await setPtzPreset(mockClient, 0, 5, "Main Gate", 1);

      expect(mockClient.api).toHaveBeenCalledWith("SetPtzPreset", {
        PtzPreset: {
          channel: 0,
          id: 5,
          name: "Main Gate",
          enable: 1,
        },
      });
    });

    it("should call SetPtzPreset without enable parameter", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await setPtzPreset(mockClient, 0, 3, "Side Door");

      expect(mockClient.api).toHaveBeenCalledWith("SetPtzPreset", {
        PtzPreset: {
          channel: 0,
          id: 3,
          name: "Side Door",
        },
      });
    });

    it("should use default name if not provided", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await setPtzPreset(mockClient, 0, 7);

      const call = vi.mocked(mockClient.api).mock.calls[0];
      const params = call[1] as { PtzPreset: { name: string } };
      expect(params.PtzPreset.name).toBe("Preset 7");
    });

    it("should throw error for preset ID below 0", async () => {
      await expect(
        setPtzPreset(mockClient, 0, -1, "Invalid")
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset ID above 64", async () => {
      await expect(
        setPtzPreset(mockClient, 0, 65, "Invalid")
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset name exceeding 31 characters", async () => {
      const longName = "This is a very long preset name that exceeds the limit";
      await expect(
        setPtzPreset(mockClient, 0, 1, longName)
      ).rejects.toThrow("Preset name must not exceed 31 characters");
    });

    it("should accept preset ID 0", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await setPtzPreset(mockClient, 0, 0, "Default");

      expect(mockClient.api).toHaveBeenCalledWith("SetPtzPreset", {
        PtzPreset: {
          channel: 0,
          id: 0,
          name: "Default",
        },
      });
    });

    it("should accept preset ID 64", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await setPtzPreset(mockClient, 0, 64, "Max Preset");

      expect(mockClient.api).toHaveBeenCalledWith("SetPtzPreset", {
        PtzPreset: {
          channel: 0,
          id: 64,
          name: "Max Preset",
        },
      });
    });

    it("should accept preset name with exactly 31 characters", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      const exactName = "1234567890123456789012345678901"; // 31 chars
      await setPtzPreset(mockClient, 0, 1, exactName);

      expect(mockClient.api).toHaveBeenCalled();
    });
  });

  describe("ptzCtrl", () => {
    it("should call PtzCtrl with ToPos operation", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "ToPos",
        id: 3,
        speed: 32,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 3,
        speed: 32,
      });
    });

    it("should call PtzCtrl with directional movement", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "Left",
        speed: 20,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "Left",
        speed: 20,
      });
    });

    it("should call PtzCtrl with all directional operations", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      const operations = [
        "Left", "Right", "Up", "Down", 
        "LeftUp", "LeftDown", "RightUp", "RightDown"
      ] as const;

      for (const op of operations) {
        await ptzCtrl(mockClient, {
          channel: 0,
          op,
          speed: 32,
        });
      }

      expect(mockClient.api).toHaveBeenCalledTimes(operations.length);
    });

    it("should call PtzCtrl with zoom operations", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "ZoomInc",
        speed: 10,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ZoomInc",
        speed: 10,
      });
    });

    it("should call PtzCtrl with focus operations", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "FocusInc",
        speed: 15,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "FocusInc",
        speed: 15,
      });
    });

    it("should call PtzCtrl with Stop operation", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "Stop",
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "Stop",
      });
    });

    it("should call PtzCtrl with Auto operation", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "Auto",
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "Auto",
      });
    });

    it("should call PtzCtrl with StartPatrol operation", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "StartPatrol",
        id: 1,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "StartPatrol",
        id: 1,
      });
    });

    it("should call PtzCtrl with StopPatrol operation", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "StopPatrol",
        id: 2,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "StopPatrol",
        id: 2,
      });
    });

    it("should throw error for speed below 1", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "Left",
          speed: 0,
        })
      ).rejects.toThrow("PTZ speed must be between 1 and 64");
    });

    it("should throw error for speed above 64", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "Right",
          speed: 65,
        })
      ).rejects.toThrow("PTZ speed must be between 1 and 64");
    });

    it("should throw error for preset ID below 0 in ToPos", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "ToPos",
          id: -1,
        })
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for preset ID above 64 in ToPos", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "ToPos",
          id: 65,
        })
      ).rejects.toThrow("Preset ID must be between 0 and 64");
    });

    it("should throw error for patrol ID below 0", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "StartPatrol",
          id: -1,
        })
      ).rejects.toThrow("Patrol ID must be between 0 and 5");
    });

    it("should throw error for patrol ID above 5", async () => {
      await expect(
        ptzCtrl(mockClient, {
          channel: 0,
          op: "StopPatrol",
          id: 6,
        })
      ).rejects.toThrow("Patrol ID must be between 0 and 5");
    });

    it("should accept speed 1 (minimum valid)", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "Up",
        speed: 1,
      });

      expect(mockClient.api).toHaveBeenCalled();
    });

    it("should accept speed 64 (maximum valid)", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "Down",
        speed: 64,
      });

      expect(mockClient.api).toHaveBeenCalled();
    });

    it("should accept preset ID 0 in ToPos", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "ToPos",
        id: 0,
      });

      expect(mockClient.api).toHaveBeenCalled();
    });

    it("should accept patrol ID 0", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "StartPatrol",
        id: 0,
      });

      expect(mockClient.api).toHaveBeenCalled();
    });

    it("should accept patrol ID 5", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "StopPatrol",
        id: 5,
      });

      expect(mockClient.api).toHaveBeenCalled();
    });

    it("should handle ToPos with x, y, z coordinates", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "ToPos",
        id: 1,
        x: 100,
        y: 200,
        z: 50,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 1,
        x: 100,
        y: 200,
        z: 50,
      });
    });

    it("should handle ToPos with x, y but no z", async () => {
      const mockResponse = { code: 0 };
      vi.mocked(mockClient.api).mockResolvedValue(mockResponse);

      await ptzCtrl(mockClient, {
        channel: 0,
        op: "ToPos",
        id: 1,
        x: 100,
        y: 200,
      });

      expect(mockClient.api).toHaveBeenCalledWith("PtzCtrl", {
        channel: 0,
        op: "ToPos",
        id: 1,
        x: 100,
        y: 200,
      });
    });
  });
});
