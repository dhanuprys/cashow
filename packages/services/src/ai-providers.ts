import {
  type AiProviderType,
  aiProviderConfigCreateSchema,
  aiProviderConfigUpdateSchema,
  firstIssue,
  validateProviderModel,
} from "@cashow/domain";

export type { AiProviderType };

import { writeAudit } from "./audit";
import type { UseCaseContext } from "./context";
import { LedgerError, toLedgerError } from "./errors";
import { err, ok, type Result } from "./result";

export interface AiProviderSummary {
  id: string;
  provider: AiProviderType;
  name: string;
  maskedApiKey: string;
  baseUrl: string | null;
  model: string;
  customModels: string[];
  isDefault: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderDetail {
  id: string;
  provider: AiProviderType;
  name: string;
  apiKey: string;
  baseUrl: string | null;
  model: string;
  customModels: string[];
  isDefault: boolean;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageLogItem {
  id: string;
  providerConfigId: string;
  providerName?: string;
  providerType?: AiProviderType;
  threadId: string | null;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  createdAt: string;
}

export interface AiTokenUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCalls: number;
  logs: AiUsageLogItem[];
}

function maskKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  const start = key.slice(0, 3);
  const end = key.slice(-4);
  return `${start}••••${end}`;
}

function parseCustomModels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  return [];
}

export async function listAiProviderConfigs(
  ctx: UseCaseContext,
): Promise<Result<AiProviderSummary[]>> {
  try {
    const rows = await ctx.db.orm.public.AiProviderConfig.where({ userId: ctx.userId })
      .orderBy((c) => c.createdAt.desc())
      .all();

    const items: AiProviderSummary[] = rows.map((r) => ({
      id: r.id,
      provider: r.provider as AiProviderType,
      name: r.name,
      maskedApiKey: maskKey(r.apiKey),
      baseUrl: r.baseUrl,
      model: r.model,
      customModels: parseCustomModels(r.customModels),
      isDefault: r.isDefault,
      totalInputTokens: r.totalInputTokens ?? 0,
      totalOutputTokens: r.totalOutputTokens ?? 0,
      totalTokens: r.totalTokens ?? 0,
      createdAt: String(r.createdAt),
      updatedAt: String(r.updatedAt),
    }));

    return ok(items);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getAiProviderConfig(
  ctx: UseCaseContext,
  id: string,
): Promise<Result<AiProviderDetail | null>> {
  try {
    const row = await ctx.db.orm.public.AiProviderConfig.where({
      id,
      userId: ctx.userId,
    }).first();

    if (row === null) return ok(null);

    return ok({
      id: row.id,
      provider: row.provider as AiProviderType,
      name: row.name,
      apiKey: row.apiKey,
      baseUrl: row.baseUrl,
      model: row.model,
      customModels: parseCustomModels(row.customModels),
      isDefault: row.isDefault,
      totalInputTokens: row.totalInputTokens ?? 0,
      totalOutputTokens: row.totalOutputTokens ?? 0,
      totalTokens: row.totalTokens ?? 0,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getDefaultAiProviderConfig(
  ctx: UseCaseContext,
): Promise<Result<AiProviderDetail | null>> {
  try {
    const row =
      (await ctx.db.orm.public.AiProviderConfig.where({
        userId: ctx.userId,
        isDefault: true,
      }).first()) ??
      (await ctx.db.orm.public.AiProviderConfig.where({ userId: ctx.userId })
        .orderBy((c) => c.createdAt.desc())
        .first());

    if (row === null) return ok(null);

    return ok({
      id: row.id,
      provider: row.provider as AiProviderType,
      name: row.name,
      apiKey: row.apiKey,
      baseUrl: row.baseUrl,
      model: row.model,
      customModels: parseCustomModels(row.customModels),
      isDefault: row.isDefault,
      totalInputTokens: row.totalInputTokens ?? 0,
      totalOutputTokens: row.totalOutputTokens ?? 0,
      totalTokens: row.totalTokens ?? 0,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function createAiProviderConfig(
  ctx: UseCaseContext,
  input: unknown,
): Promise<Result<AiProviderSummary>> {
  const parsed = aiProviderConfigCreateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  const data = parsed.data;

  try {
    let createdConfig: AiProviderSummary | null = null;

    await ctx.db.transaction(async (tx) => {
      // Check if this is the user's first config
      const count = (await tx.orm.public.AiProviderConfig.where({ userId: ctx.userId }).all())
        .length;
      const shouldBeDefault = data.isDefault || count === 0;

      if (shouldBeDefault) {
        // Unset any existing default
        const existing = await tx.orm.public.AiProviderConfig.where({
          userId: ctx.userId,
          isDefault: true,
        }).all();
        for (const item of existing) {
          await tx.orm.public.AiProviderConfig.where({ id: item.id, userId: ctx.userId }).update({
            isDefault: false,
          });
        }
      }

      let resolvedApiKey = data.apiKey;
      let resolvedBaseUrl = data.baseUrl && data.baseUrl.trim() !== "" ? data.baseUrl.trim() : null;

      if ((!resolvedApiKey || resolvedApiKey.trim() === "") && data.copyApiKeyFromId) {
        const source = await tx.orm.public.AiProviderConfig.where({
          id: data.copyApiKeyFromId,
          userId: ctx.userId,
        }).first();

        if (!source) {
          throw new LedgerError("NOT_FOUND", "Sumber API key tersimpan tidak ditemukan.");
        }

        resolvedApiKey = source.apiKey;
        if (!resolvedBaseUrl && source.baseUrl) {
          resolvedBaseUrl = source.baseUrl;
        }
      }

      const customModels = Array.isArray(data.customModels) ? data.customModels : [];

      const created = await tx.orm.public.AiProviderConfig.create({
        userId: ctx.userId,
        provider: data.provider,
        name: data.name,
        apiKey: resolvedApiKey,
        baseUrl: resolvedBaseUrl,
        model: data.model,
        customModels,
        isDefault: shouldBeDefault,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "AiProviderConfig",
        entityId: created.id,
        action: "CREATE",
        after: {
          id: created.id,
          provider: created.provider,
          name: created.name,
          model: created.model,
          customModels,
          isDefault: created.isDefault,
        },
        actorId: null,
      });

      createdConfig = {
        id: created.id,
        provider: created.provider as AiProviderType,
        name: created.name,
        maskedApiKey: maskKey(created.apiKey),
        baseUrl: created.baseUrl,
        model: created.model,
        customModels,
        isDefault: created.isDefault,
        totalInputTokens: created.totalInputTokens ?? 0,
        totalOutputTokens: created.totalOutputTokens ?? 0,
        totalTokens: created.totalTokens ?? 0,
        createdAt: String(created.createdAt),
        updatedAt: String(created.updatedAt),
      };
    });

    if (createdConfig === null) {
      throw new LedgerError("INTERNAL", "Gagal membuat konfigurasi AI.");
    }

    return ok(createdConfig);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function updateAiProviderConfig(
  ctx: UseCaseContext,
  id: string,
  input: unknown,
): Promise<Result<void>> {
  const parsed = aiProviderConfigUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return err(new LedgerError("VALIDATION", firstIssue(parsed.error)));
  }

  const patch = parsed.data;

  try {
    await ctx.db.transaction(async (tx) => {
      const existing = await tx.orm.public.AiProviderConfig.where({
        id,
        userId: ctx.userId,
      }).first();

      if (existing === null) {
        throw new LedgerError("NOT_FOUND", "Konfigurasi AI tidak ditemukan.");
      }

      if (patch.model !== undefined) {
        const errorMsg = validateProviderModel(existing.provider as AiProviderType, patch.model);
        if (errorMsg) {
          throw new LedgerError("VALIDATION", errorMsg);
        }
      }

      if (patch.isDefault === true) {
        const others = await tx.orm.public.AiProviderConfig.where({
          userId: ctx.userId,
          isDefault: true,
        }).all();
        for (const item of others) {
          if (item.id !== id) {
            await tx.orm.public.AiProviderConfig.where({ id: item.id, userId: ctx.userId }).update({
              isDefault: false,
            });
          }
        }
      }

      await tx.orm.public.AiProviderConfig.where({ id, userId: ctx.userId }).update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.apiKey !== undefined ? { apiKey: patch.apiKey } : {}),
        ...(patch.baseUrl !== undefined
          ? { baseUrl: patch.baseUrl && patch.baseUrl.trim() !== "" ? patch.baseUrl.trim() : null }
          : {}),
        ...(patch.model !== undefined ? { model: patch.model } : {}),
        ...(patch.customModels !== undefined ? { customModels: patch.customModels } : {}),
        ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
      });

      const { apiKey: _omittedKey, ...safePatch } = patch;
      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "AiProviderConfig",
        entityId: id,
        action: "UPDATE",
        after: {
          ...safePatch,
          ...(patch.apiKey !== undefined ? { apiKey: maskKey(patch.apiKey) } : {}),
        },
        actorId: null,
      });
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function setDefaultAiProviderConfig(
  ctx: UseCaseContext,
  id: string,
): Promise<Result<void>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const target = await tx.orm.public.AiProviderConfig.where({
        id,
        userId: ctx.userId,
      }).first();

      if (target === null) {
        throw new LedgerError("NOT_FOUND", "Konfigurasi AI tidak ditemukan.");
      }

      // Unset all defaults
      const existing = await tx.orm.public.AiProviderConfig.where({
        userId: ctx.userId,
        isDefault: true,
      }).all();

      for (const item of existing) {
        if (item.id !== id) {
          await tx.orm.public.AiProviderConfig.where({ id: item.id, userId: ctx.userId }).update({
            isDefault: false,
          });
        }
      }

      // Set target to default
      await tx.orm.public.AiProviderConfig.where({ id, userId: ctx.userId }).update({
        isDefault: true,
      });

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "AiProviderConfig",
        entityId: id,
        action: "UPDATE",
        after: { id, isDefault: true },
        actorId: null,
      });
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function deleteAiProviderConfig(
  ctx: UseCaseContext,
  id: string,
): Promise<Result<void>> {
  try {
    await ctx.db.transaction(async (tx) => {
      const before = await tx.orm.public.AiProviderConfig.where({
        id,
        userId: ctx.userId,
      }).first();

      if (before === null) {
        throw new LedgerError("NOT_FOUND", "Konfigurasi AI tidak ditemukan.");
      }

      await tx.orm.public.AiProviderConfig.where({ id, userId: ctx.userId }).deleteAll();

      // If the deleted config was default, pick another one if available
      if (before.isDefault) {
        const remaining = await tx.orm.public.AiProviderConfig.where({
          userId: ctx.userId,
        })
          .orderBy((c) => c.createdAt.desc())
          .first();

        if (remaining !== null) {
          await tx.orm.public.AiProviderConfig.where({
            id: remaining.id,
            userId: ctx.userId,
          }).update({
            isDefault: true,
          });
        }
      }

      await writeAudit(tx, {
        userId: ctx.userId,
        entityType: "AiProviderConfig",
        entityId: id,
        action: "SOFT_DELETE",
        after: null,
        actorId: null,
      });
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function recordAiUsageLog(
  ctx: UseCaseContext,
  input: {
    providerConfigId: string;
    modelId: string;
    threadId?: string | null;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  },
): Promise<Result<void>> {
  try {
    const inputTokens = Math.max(0, Math.round(input.inputTokens || 0));
    const outputTokens = Math.max(0, Math.round(input.outputTokens || 0));
    const totalTokens = Math.max(0, Math.round(input.totalTokens || inputTokens + outputTokens));

    await ctx.db.transaction(async (tx) => {
      // 1. Insert detailed per-call log
      await tx.orm.public.AiUsageLog.create({
        userId: ctx.userId,
        providerConfigId: input.providerConfigId,
        threadId: input.threadId ?? null,
        modelId: input.modelId,
        inputTokens,
        outputTokens,
        totalTokens,
      });

      // 2. Increment cumulative counters on AiProviderConfig
      const cfg = await tx.orm.public.AiProviderConfig.where({
        id: input.providerConfigId,
        userId: ctx.userId,
      }).first();

      if (cfg) {
        await tx.orm.public.AiProviderConfig.where({
          id: input.providerConfigId,
          userId: ctx.userId,
        }).update({
          totalInputTokens: (cfg.totalInputTokens ?? 0) + inputTokens,
          totalOutputTokens: (cfg.totalOutputTokens ?? 0) + outputTokens,
          totalTokens: (cfg.totalTokens ?? 0) + totalTokens,
        });
      }
    });

    return ok(undefined);
  } catch (error) {
    return err(toLedgerError(error));
  }
}

export async function getAiTokenUsageStats(
  ctx: UseCaseContext,
  options?: {
    providerConfigId?: string;
    limit?: number;
  },
): Promise<Result<AiTokenUsageStats>> {
  try {
    const limit = Math.min(options?.limit ?? 50, 200);

    // Fetch providers to enrich logs with names
    const configs = await ctx.db.orm.public.AiProviderConfig.where({ userId: ctx.userId }).all();
    const configMap = new Map(configs.map((c) => [c.id, c]));

    let query = ctx.db.orm.public.AiUsageLog.where({ userId: ctx.userId });
    if (options?.providerConfigId) {
      query = ctx.db.orm.public.AiUsageLog.where({
        userId: ctx.userId,
        providerConfigId: options.providerConfigId,
      });
    }

    const rows = await query
      .orderBy((l) => l.createdAt.desc())
      .limit(limit)
      .all();

    // Calculate user-wide running totals across all configs or specific config
    let sumInput = 0;
    let sumOutput = 0;
    let sumTotal = 0;

    if (options?.providerConfigId) {
      const target = configMap.get(options.providerConfigId);
      if (target) {
        sumInput = target.totalInputTokens ?? 0;
        sumOutput = target.totalOutputTokens ?? 0;
        sumTotal = target.totalTokens ?? 0;
      }
    } else {
      for (const c of configs) {
        sumInput += c.totalInputTokens ?? 0;
        sumOutput += c.totalOutputTokens ?? 0;
        sumTotal += c.totalTokens ?? 0;
      }
    }

    const logs: AiUsageLogItem[] = rows.map((r) => {
      const cfg = configMap.get(r.providerConfigId);
      return {
        id: r.id,
        providerConfigId: r.providerConfigId,
        providerName: cfg?.name,
        providerType: cfg?.provider as AiProviderType | undefined,
        threadId: r.threadId,
        modelId: r.modelId,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        totalTokens: r.totalTokens,
        createdAt: String(r.createdAt),
      };
    });

    return ok({
      totalInputTokens: sumInput,
      totalOutputTokens: sumOutput,
      totalTokens: sumTotal,
      totalCalls: rows.length,
      logs,
    });
  } catch (error) {
    return err(toLedgerError(error));
  }
}
