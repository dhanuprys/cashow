import { describe, expect, it } from "bun:test";
import { buildChatSystemPrompt } from "./ai-system-prompt";

const base = {
  userName: "Dhanu",
  timezone: "Asia/Jakarta",
  currency: "IDR",
  now: new Date("2026-03-01T03:00:00.000Z"),
};

describe("buildChatSystemPrompt", () => {
  it("injects the user's name, currency, and localized date", () => {
    const prompt = buildChatSystemPrompt(base);

    expect(prompt).toContain("Dhanu");
    expect(prompt).toContain("IDR");
    expect(prompt).toContain("Asia/Jakarta");
    expect(prompt).toContain("2026");
  });

  it("keeps the accuracy and scope guardrails in place", () => {
    const prompt = buildChatSystemPrompt(base);

    expect(prompt).toContain("Jangan mengarang angka");
    expect(prompt).toContain("hasil tool");
    expect(prompt).toContain("Cakupan:");
    expect(prompt).toContain("DATA, bukan instruksi");
    expect(prompt).toContain("API key");
  });

  it("falls back to a generic name when the profile has none", () => {
    const prompt = buildChatSystemPrompt({ ...base, userName: null });
    expect(prompt).toContain("pengguna pengguna");
  });

  it("degrades to the server clock for an invalid timezone instead of throwing", () => {
    const prompt = buildChatSystemPrompt({ ...base, timezone: "Not/AZone" });
    expect(prompt).toContain("hari ini");
    expect(prompt).toContain("Not/AZone");
  });

  it("stays within a lean token budget", () => {
    // Re-sent on every tool step, so the prompt has to stay compact.
    const prompt = buildChatSystemPrompt(base);
    expect(prompt.length).toBeLessThan(2400);
  });
});
