# LLM Token Usage Tracking & Analytics

## Problem Statement

How might we provide full transparency and auditability into AI token consumption (input tokens, output tokens, and total usage) per provider connection so users can monitor quotas, manage expenses, and identify high-consumption queries?

## Recommended Direction

Capture token usage from Vercel AI SDK v7's `onFinish` lifecycle event in `apps/web/app/api/chat/route.ts` (`event.usage` containing `inputTokens`, `outputTokens`, `totalTokens`).

Record per-call usage logs in a dedicated `AiUsageLog` database model linked to `userId`, `providerConfigId`, and `threadId`, while maintaining running aggregated totals (`totalInputTokens`, `totalOutputTokens`, `totalTokens`) on `AiProviderConfig` for instantaneous summary reads in the settings list.

In the UI:
1. **Model Settings Summary Header / List Cards**: Display total tokens consumed across all providers and per provider account card (with a badge/metric strip showing input, output, and total tokens).
2. **Provider Detail / Usage Sheet/Modal**: An expandable breakdown showing per-model usage and recent call history with timestamps and token split.

## Key Assumptions to Validate

- [ ] Vercel AI SDK v7's `streamText({ onFinish: (event) => ... })` consistently yields valid `usage.inputTokens` and `usage.outputTokens` across DeepSeek, Google Gemini, and OpenAI-compatible providers.
- [ ] Storing per-call token logs doesn't add perceptible latency to stream closure (resolved asynchronously without blocking the stream).
- [ ] Cascade deletion on `AiProviderConfig` cleanly removes associated `AiUsageLog` entries without orphan locks.

## MVP Scope

1. **Database Schema (`packages/db/src/prisma/contract.prisma`)**:
   - Add `AiUsageLog` model (`id`, `userId`, `providerConfigId`, `modelId`, `inputTokens`, `outputTokens`, `totalTokens`, `createdAt`).
   - Add running totals to `AiProviderConfig`: `totalInputTokens`, `totalOutputTokens`, `totalTokens` (default: 0).
2. **API Streaming Hook (`apps/web/app/api/chat/route.ts`)**:
   - In `streamText`, register `onFinish` to record usage into `AiUsageLog` and increment `AiProviderConfig` counters atomically.
3. **Services (`packages/services/src/ai-providers.ts`)**:
   - Expose token stats (`totalInputTokens`, `totalOutputTokens`, `totalTokens`, call count) on `AiProviderSummary` and `listAiProviderConfigs`.
   - Add `getAiProviderUsageStats(ctx, providerConfigId?)` for granular per-model and historical logs.
4. **UI Display (`apps/web/components/ledger/ai-model-manager.tsx`)**:
   - Add a high-level KPI strip in AI Model Settings showing Total Tokens, Input Tokens, Output Tokens across all models.
   - Add per-provider token badges on each provider card showing Input / Output / Total token counts.
   - Add an interactive usage dialog/drawer showing recent token usage history.

## Not Doing (and Why)

- **Hard token quotas / throttling**: Kept out of scope for MVP to prevent accidentally blocking legitimate emergency user queries; alerts and warnings can be added later if needed.
- **Dynamic USD pricing / cost calculator**: Provider pricing fluctuates frequently and differs between tiers and batch discounts; showing exact input/output tokens is source-of-truth and robust.
- **Per-message token counter in chat UI**: Clutters the conversational flow; token tracking belongs in settings and analytics.

## Open Questions

- Should deleting a provider account keep historical logs anonymously or cascade delete? (Recommendation: Cascade delete with provider config to maintain clean data privacy).
