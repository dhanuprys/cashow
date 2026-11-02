import { describe, expect, test } from "bun:test";
import {
  accountInputSchema,
  aiProviderConfigCreateSchema,
  aiProviderConfigUpdateSchema,
  categoryInputSchema,
  chatMessageCreateSchema,
  chatThreadCreateSchema,
  chatThreadUpdateSchema,
  formatDateTime,
  localDateTimeToUtc,
  parseDbTimestamp,
  parseMoney,
  positiveMoneyText,
  toLocalDate,
  toLocalDateTimeInput,
  transactionCreateSchema,
} from "./index";

describe("positiveMoneyText", () => {
  test("accepts Indonesian shorthand and returns bigint", () => {
    expect(positiveMoneyText.parse("35rb")).toBe(35_000n);
    expect(positiveMoneyText.parse("1,5jt")).toBe(1_500_000n);
    expect(positiveMoneyText.parse("Rp 250.000")).toBe(250_000n);
  });

  test("rejects zero, negative and unreadable amounts", () => {
    expect(positiveMoneyText.safeParse("0").success).toBe(false);
    expect(positiveMoneyText.safeParse("-5rb").success).toBe(false);
    expect(positiveMoneyText.safeParse("banyak").success).toBe(false);
    expect(positiveMoneyText.safeParse("").success).toBe(false);
  });
});

describe("accountInputSchema", () => {
  test("defaults currency and parses a negative opening balance", () => {
    const parsed = accountInputSchema.parse({
      name: "Kartu Kredit",
      type: "BANK",
      openingBalance: "-250rb",
    });
    expect(parsed.openingBalance).toBe(-250_000n);
    expect(parsed.currency).toBe("IDR");
  });
});

describe("categoryInputSchema", () => {
  test("normalizes empty optional fields to null", () => {
    const parsed = categoryInputSchema.parse({
      name: "Makan",
      kind: "EXPENSE",
      parentId: "",
      icon: undefined,
    });
    expect(parsed.parentId).toBeNull();
    expect(parsed.icon).toBeNull();
  });
});

describe("transactionCreateSchema", () => {
  test("parses an expense with allocations", () => {
    const parsed = transactionCreateSchema.parse({
      type: "EXPENSE",
      amount: "250000",
      accountId: "acc-1",
      categoryId: "cat-1",
      occurredAtLocal: "2026-10-27T09:30",
      allocations: [{ incomeId: "inc-1", amount: "250rb" }],
    });

    expect(parsed.amount).toBe(250_000n);
    expect(parsed.allocations[0]?.amount).toBe(250_000n);
    expect(parsed.source).toBe("MANUAL");
  });

  test("rejects an unknown type and a malformed local date", () => {
    expect(
      transactionCreateSchema.safeParse({
        type: "TRANSFER",
        amount: "1",
        accountId: "a",
        occurredAtLocal: "2026-10-27T09:30",
      }).success,
    ).toBe(false);

    expect(
      transactionCreateSchema.safeParse({
        type: "INCOME",
        amount: "1",
        accountId: "a",
        occurredAtLocal: "2026-10-27 09:30",
      }).success,
    ).toBe(false);
  });
});

describe("timestamps", () => {
  test("parses PostgreSQL text timestamps", () => {
    const fromPg = parseDbTimestamp("2026-10-27 01:45:51.602+00");
    expect(fromPg.toISOString()).toBe("2026-10-27T01:45:51.602Z");

    const withOffset = parseDbTimestamp("2026-10-27 08:45:51.602+07");
    expect(withOffset.toISOString()).toBe("2026-10-27T01:45:51.602Z");
  });

  test("round-trips a local datetime input in WIB", () => {
    const instant = localDateTimeToUtc("2026-10-27T09:30", "Asia/Jakarta");
    expect(instant.toISOString()).toBe("2026-10-27T02:30:00.000Z");
    expect(toLocalDateTimeInput(instant, "Asia/Jakarta")).toBe("2026-10-27T09:30");
    expect(toLocalDate(instant, "Asia/Jakarta")).toBe("2026-10-27");
  });

  test("formats an instant in Indonesian", () => {
    expect(formatDateTime(new Date("2026-10-27T02:30:00Z"), "Asia/Jakarta")).toMatch(
      /27 Okt 2026.*09\.30/,
    );
  });

  test("does not depend on the host timezone", () => {
    const amount = parseMoney("1.500.000");
    expect(amount).toBe(1_500_000n);
  });
});

describe("aiProviderConfigCreateSchema", () => {
  test("validates valid provider configurations", () => {
    const google = aiProviderConfigCreateSchema.parse({
      provider: "GOOGLE",
      name: "Gemini 3.8 Flash",
      apiKey: "AIzaSy...",
      model: "gemini-3.8-flash",
    });
    expect(google.provider).toBe("GOOGLE");
    expect(google.model).toBe("gemini-3.8-flash");
    expect(google.isDefault).toBe(false);

    const google35 = aiProviderConfigCreateSchema.parse({
      provider: "GOOGLE",
      name: "Gemini 3.5 Flash",
      apiKey: "AIzaSy...",
      model: "gemini-3.5-flash",
    });
    expect(google35.model).toBe("gemini-3.5-flash");

    const deepseekPro = aiProviderConfigCreateSchema.parse({
      provider: "DEEPSEEK",
      name: "DeepSeek V4 Pro",
      apiKey: "sk-...",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      isDefault: true,
    });
    expect(deepseekPro.provider).toBe("DEEPSEEK");
    expect(deepseekPro.model).toBe("deepseek-v4-pro");
    expect(deepseekPro.isDefault).toBe(true);

    const deepseekFlash = aiProviderConfigCreateSchema.parse({
      provider: "DEEPSEEK",
      name: "DeepSeek V4 Flash",
      apiKey: "sk-...",
      model: "deepseek-v4-flash",
    });
    expect(deepseekFlash.model).toBe("deepseek-v4-flash");

    const openai = aiProviderConfigCreateSchema.parse({
      provider: "OPENAI",
      name: "OpenAI GPT-4o Mini",
      apiKey: "sk-...",
      model: "gpt-4o-mini",
    });
    expect(openai.model).toBe("gpt-4o-mini");
  });

  test("enforces DeepSeek valid models (presets or custom) and rejects legacy obsolete versions", () => {
    // Legacy obsolete models must be rejected
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek V2",
        apiKey: "sk-...",
        model: "deepseek-v2",
      }).success,
    ).toBe(false);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek V3",
        apiKey: "sk-...",
        model: "deepseek-v3",
      }).success,
    ).toBe(false);

    // Standard deepseek-chat and deepseek-reasoner aliases must be accepted
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek Chat",
        apiKey: "sk-...",
        model: "deepseek-chat",
      }).success,
    ).toBe(true);

    // Custom modern models or reasoning models must be accepted
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek Reasoner",
        apiKey: "sk-...",
        model: "deepseek-reasoner",
      }).success,
    ).toBe(true);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek AI custom",
        apiKey: "sk-...",
        model: "deepseek-ai/DeepSeek-V4",
      }).success,
    ).toBe(true);
  });

  test("enforces Gemini minimum version of 2.5 for both presets and custom models", () => {
    // Versions < 2.5 must be rejected
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 1.5",
        apiKey: "AIzaSy...",
        model: "gemini-1.5-flash",
      }).success,
    ).toBe(false);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 2.0",
        apiKey: "AIzaSy...",
        model: "gemini-2.0-flash",
      }).success,
    ).toBe(false);

    // Version >= 2.5 must be accepted (including custom pro / exp variants)
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 2.5",
        apiKey: "AIzaSy...",
        model: "gemini-2.5-flash",
      }).success,
    ).toBe(true);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 3.5",
        apiKey: "AIzaSy...",
        model: "gemini-3.5-flash",
      }).success,
    ).toBe(true);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 3.8",
        apiKey: "AIzaSy...",
        model: "gemini-3.8-flash",
      }).success,
    ).toBe(true);

    // Custom models >= 3.5 like Pro or custom endpoints
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 3.8 Pro",
        apiKey: "AIzaSy...",
        model: "gemini-3.8-pro",
      }).success,
    ).toBe(true);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini 3.5 Pro",
        apiKey: "AIzaSy...",
        model: "gemini-3.5-pro",
      }).success,
    ).toBe(true);
  });

  test("allows custom OpenAI, Omniroute, and proxy models with special identifiers", () => {
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI",
        name: "OpenAI o1",
        apiKey: "sk-...",
        model: "o1",
      }).success,
    ).toBe(true);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI",
        name: "OpenRouter Custom",
        apiKey: "sk-...",
        model: "anthropic/claude-3.5-sonnet",
      }).success,
    ).toBe(true);

    // Omniroute and high-variant custom models
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI",
        name: "Omniroute Gemini Flash High",
        apiKey: "sk-omniroute-...",
        baseUrl: "https://api.omniroute.ai/v1",
        model: "agy/gemini-3.8-flash-high",
      }).success,
    ).toBe(true);

    // Cloudflare / scoped model formats (@cf/...)
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI",
        name: "Cloudflare AI",
        apiKey: "cf-token",
        model: "@cf/meta/llama-3-8b-instruct",
      }).success,
    ).toBe(true);

    // Variant tags with #
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI",
        name: "Omniroute Variant",
        apiKey: "sk-...",
        model: "provider/model#fast",
      }).success,
    ).toBe(true);
  });

  test("supports OPENAI_COMPATIBLE provider with custom models and required baseUrl", () => {
    // Valid OpenAI Compatible with baseUrl and custom models
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI_COMPATIBLE",
        name: "Omniroute Gateway",
        apiKey: "sk-omniroute-123",
        baseUrl: "https://api.omniroute.ai/v1",
        customModels: ["agy/gemini-3.8-flash-high", "chatgpt-4o-latest"],
      }).success,
    ).toBe(true);

    // Rejects if baseUrl is missing for OPENAI_COMPATIBLE
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI_COMPATIBLE",
        name: "Omniroute Missing Base URL",
        apiKey: "sk-omniroute-123",
        customModels: ["chatgpt-4o-latest"],
      }).success,
    ).toBe(false);

    // Rejects if no models are specified for OPENAI_COMPATIBLE
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "OPENAI_COMPATIBLE",
        name: "Omniroute Missing Models",
        apiKey: "sk-omniroute-123",
        baseUrl: "https://api.omniroute.ai/v1",
        customModels: [],
      }).success,
    ).toBe(false);
  });

  test("supports multiple custom models for DeepSeek, Gemini, and ChatGPT", () => {
    // Gemini with multiple custom models
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini Workspace",
        apiKey: "AIzaSy...",
        customModels: ["gemini-3.8-pro", "gemini-3.5-pro"],
      }).success,
    ).toBe(true);

    // DeepSeek with custom models
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "DEEPSEEK",
        name: "DeepSeek Lab",
        apiKey: "sk-...",
        customModels: ["deepseek-reasoner"],
      }).success,
    ).toBe(true);

    // Rejects if any custom model has invalid format or version
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Gemini Invalid Custom",
        apiKey: "AIzaSy...",
        customModels: ["gemini-2.0-flash"],
      }).success,
    ).toBe(false);
  });

  test("rejects invalid provider or empty required fields", () => {
    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "CLAUDE",
        name: "Test",
        apiKey: "key",
        model: "model",
      }).success,
    ).toBe(false);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "",
        apiKey: "key",
        model: "gemini-3.8-flash",
      }).success,
    ).toBe(false);

    expect(
      aiProviderConfigCreateSchema.safeParse({
        provider: "GOOGLE",
        name: "Test",
        apiKey: "",
        model: "gemini-3.8-flash",
      }).success,
    ).toBe(false);
  });

  test("validates partial updates", () => {
    const updated = aiProviderConfigUpdateSchema.parse({
      name: "Updated Name",
      model: "gemini-3.8-flash",
      isDefault: true,
    });
    expect(updated.name).toBe("Updated Name");
    expect(updated.model).toBe("gemini-3.8-flash");
    expect(updated.isDefault).toBe(true);
    expect(updated.apiKey).toBeUndefined();

    // Rejects outdated Gemini on update with provider
    expect(
      aiProviderConfigUpdateSchema.safeParse({
        provider: "GOOGLE",
        model: "gemini-1.5-flash",
      }).success,
    ).toBe(false);

    expect(
      aiProviderConfigUpdateSchema.safeParse({
        name: "",
      }).success,
    ).toBe(false);
  });
});

describe("chatThreadCreateSchema & chatThreadUpdateSchema", () => {
  test("accepts empty create input and parses optional fields", () => {
    const parsed = chatThreadCreateSchema.parse({});
    expect(parsed.title).toBeUndefined();
    expect(parsed.modelId).toBeUndefined();
    expect(parsed.isFavorite).toBeUndefined();

    const withData = chatThreadCreateSchema.parse({
      title: "  Evaluasi Dana Darurat  ",
      modelId: "conn-1::gemini-3.8-flash",
      isFavorite: true,
    });
    expect(withData.title).toBe("Evaluasi Dana Darurat");
    expect(withData.modelId).toBe("conn-1::gemini-3.8-flash");
    expect(withData.isFavorite).toBe(true);
  });

  test("rejects overly long title in thread creation", () => {
    expect(
      chatThreadCreateSchema.safeParse({
        title: "A".repeat(101),
      }).success,
    ).toBe(false);
  });

  test("validates thread updates", () => {
    const update = chatThreadUpdateSchema.parse({
      title: "  Judul Baru  ",
      isFavorite: true,
      modelId: null,
    });
    expect(update.title).toBe("Judul Baru");
    expect(update.isFavorite).toBe(true);
    expect(update.modelId).toBeNull();

    // Rejects empty string title
    expect(chatThreadUpdateSchema.safeParse({ title: "" }).success).toBe(false);
    expect(chatThreadUpdateSchema.safeParse({ title: "   " }).success).toBe(false);
  });
});

describe("chatMessageCreateSchema", () => {
  test("accepts valid roles and payload with parts", () => {
    const parsed = chatMessageCreateSchema.parse({
      role: "user",
      content: "Halo asisten",
      parts: [{ type: "text", text: "Halo asisten" }],
    });
    expect(parsed.role).toBe("user");
    expect(parsed.content).toBe("Halo asisten");
    expect(Array.isArray(parsed.parts)).toBe(true);
  });

  test("rejects invalid message role", () => {
    expect(
      chatMessageCreateSchema.safeParse({
        role: "admin",
        content: "Halo",
      }).success,
    ).toBe(false);
  });
});
