import { describe, expect, it } from "bun:test";
import {
  derivePKCEChallenge,
  generateOAuthState,
  generatePKCEVerifier,
  getGoogleOAuthUrl,
} from "./google";

describe("Google OAuth Security Helper", () => {
  it("generates high-entropy random state and PKCE verifier", () => {
    const state1 = generateOAuthState();
    const state2 = generateOAuthState();
    const verifier1 = generatePKCEVerifier();
    const verifier2 = generatePKCEVerifier();

    expect(state1).not.toBe(state2);
    expect(state1.length).toBeGreaterThanOrEqual(24);

    expect(verifier1).not.toBe(verifier2);
    expect(verifier1.length).toBeGreaterThanOrEqual(32);
  });

  it("correctly derives SHA256 PKCE challenge", () => {
    const verifier = "sample-code-verifier-string";
    const challenge = derivePKCEChallenge(verifier);

    expect(typeof challenge).toBe("string");
    expect(challenge.length).toBeGreaterThan(0);
    expect(derivePKCEChallenge(verifier)).toBe(challenge);
  });

  it("constructs a valid Google OAuth authorization URL with PKCE parameters", () => {
    const mockRequest = new Request("http://localhost:3000/api/auth/google", {
      headers: {
        host: "localhost:3000",
      },
    });

    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";

    try {
      const state = "test-state-token";
      const verifier = "test-verifier-token";
      const urlString = getGoogleOAuthUrl(mockRequest, state, verifier);
      const url = new URL(urlString);

      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.pathname).toBe("/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe(
        "mock-google-client-id.apps.googleusercontent.com",
      );
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("openid email profile");
      expect(url.searchParams.get("state")).toBe(state);
      expect(url.searchParams.get("code_challenge")).toBe(derivePKCEChallenge(verifier));
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("redirect_uri")).toContain("/api/auth/google/callback");
    } finally {
      process.env.GOOGLE_CLIENT_ID = prevId;
      process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    }
  });
});
