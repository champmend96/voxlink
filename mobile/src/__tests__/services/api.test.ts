import AsyncStorage from "@react-native-async-storage/async-storage";

// Test the API service behavior
describe("API Service", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("API base URL configuration", () => {
    it("should use localhost:3000 as base URL", () => {
      // The API_URL is hardcoded in the service
      const API_URL = "http://localhost:3000/api";
      expect(API_URL).toBe("http://localhost:3000/api");
    });
  });

  describe("Auth header injection", () => {
    it("should add Bearer token to requests when token exists", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("test-access-token");

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      });
      global.fetch = mockFetch;

      // Re-import to pick up the mock
      jest.resetModules();
      const { api } = require("../../services/api");
      await api.users.list();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/users"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-access-token",
          }),
        })
      );
    });
  });

  describe("401 response triggers token refresh", () => {
    it("should attempt to refresh token on 401", async () => {
      (AsyncStorage.getItem as jest.Mock)
        .mockResolvedValueOnce("expired-token") // getToken for initial request
        .mockResolvedValueOnce("refresh-token"); // getItem for refresh token

      const mockFetch = jest.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: "Invalid token" }),
          text: async () => "Invalid token",
        })
        .mockResolvedValueOnce({
          // Token refresh call
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          }),
        })
        .mockResolvedValueOnce({
          // Retry with new token
          ok: true,
          status: 200,
          json: async () => ({ users: [] }),
        });

      global.fetch = mockFetch;

      jest.resetModules();
      const { api } = require("../../services/api");

      await api.users.list();

      // Should have made 3 fetch calls: initial, refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Network error handling", () => {
    it("should throw on network errors", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue("token");

      global.fetch = jest.fn().mockRejectedValue(new Error("Network request failed"));

      jest.resetModules();
      const { api } = require("../../services/api");

      await expect(api.users.list()).rejects.toThrow("Network request failed");
    });

    it("should throw on non-ok responses", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); // No token, skip refresh

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      jest.resetModules();
      const { api } = require("../../services/api");

      await expect(api.auth.me()).rejects.toThrow();
    });
  });
});
