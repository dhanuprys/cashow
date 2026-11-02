import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { AiProviderDetail } from "@cashow/services";
import type { LanguageModel } from "ai";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

/**
 * Normalizes a Google Gemini base URL.
 *
 * @ai-sdk/google expects the version segment to be included in baseURL
 * (defaults to https://generativelanguage.googleapis.com/v1beta).
 * If a user enters a custom base URL without /v1beta (e.g. https://generativelanguage.googleapis.com),
 * requests fail with 404. We automatically normalize it to append /v1beta if missing.
 */
function normalizeGoogleBaseUrl(baseUrl?: string | null): string | undefined {
  const trimmed = baseUrl?.trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  // If already ends in /v1beta, /v1, /v1alpha, etc.
  if (/\/v\d+(?:alpha|beta)?\d*$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/v1beta`;
}

/**
 * Builds a Vercel AI SDK language model from a stored provider configuration.
 *
 * Kept in one place so the chat route and the "test connection" action cannot
 * drift apart: a key that works in the settings dialog must also work in chat.
 */
export function buildLanguageModel(config: AiProviderDetail): LanguageModel {
  if (config.provider === "GOOGLE") {
    return createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: normalizeGoogleBaseUrl(config.baseUrl),
    })(config.model);
  }

  let baseURL = OPENAI_BASE_URL;
  if (config.provider === "DEEPSEEK") {
    baseURL = config.baseUrl?.trim() || DEEPSEEK_BASE_URL;
  } else if (config.provider === "OPENAI_COMPATIBLE") {
    baseURL = config.baseUrl?.trim() || OPENAI_BASE_URL;
  } else if (config.provider === "OPENAI") {
    baseURL = config.baseUrl?.trim() || OPENAI_BASE_URL;
  }

  return createOpenAI({ baseURL, apiKey: config.apiKey })(config.model);
}
