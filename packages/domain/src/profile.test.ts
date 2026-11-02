import { describe, expect, it } from "bun:test";
import { profileUpdateSchema } from "./schemas";

describe("profileUpdateSchema with avatar & bio", () => {
  it("accepts valid avatar and bio", () => {
    const input = {
      name: "Dhanu Pratama",
      avatar: "alex",
      bio: "Fokus menabung & investasi masa depan",
      timezone: "Asia/Jakarta",
      weekStartsOn: 1,
      budgetMonthStartDay: 25,
      currency: "IDR",
    };
    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.avatar).toBe("alex");
      expect(parsed.data.bio).toBe("Fokus menabung & investasi masa depan");
      expect(parsed.data.name).toBe("Dhanu Pratama");
    }
  });

  it("handles null / optional avatar and bio gracefully", () => {
    const input = {
      name: null,
      avatar: null,
      bio: null,
    };
    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.avatar).toBeNull();
      expect(parsed.data.bio).toBeNull();
    }
  });

  it("rejects avatar or bio that exceeds max length", () => {
    const input = {
      avatar: "a".repeat(70), // max is 64
    };
    const parsed = profileUpdateSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });
});
