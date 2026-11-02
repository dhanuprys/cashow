import { describe, expect, it } from "bun:test";
import type { UIMessage } from "ai";
import { getFollowUpSuggestions, getMessageSourceLinks } from "./ai-suggestions";

describe("getMessageSourceLinks", () => {
  it("returns unique source links for tools used", () => {
    const message: UIMessage = {
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "tool-getBudgetStatus",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {},
        },
        {
          type: "tool-getSpendingSummary",
          toolCallId: "c2",
          state: "output-available",
          input: {},
          output: {},
        },
      ],
    };

    const links = getMessageSourceLinks(message);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.href)).toEqual(["/app/budgets", "/app"]);
  });

  it("deduplicates identical target hrefs", () => {
    const message: UIMessage = {
      id: "m2",
      role: "assistant",
      parts: [
        {
          type: "tool-searchTransactions",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: {},
        },
        {
          type: "tool-getRecentTransactions",
          toolCallId: "c2",
          state: "output-available",
          input: {},
          output: {},
        },
      ],
    };

    const links = getMessageSourceLinks(message);
    expect(links).toHaveLength(1);
    expect(links[0]?.href).toBe("/app/transactions");
  });

  it("returns empty for user messages", () => {
    const message: UIMessage = {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "Halo" }],
    };
    expect(getMessageSourceLinks(message)).toEqual([]);
  });
});

describe("getFollowUpSuggestions", () => {
  it("suggests balance and budget after transaction creation", () => {
    const messages: UIMessage[] = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-createTransaction",
            toolCallId: "c1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      },
    ];

    const suggestions = getFollowUpSuggestions(messages);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions.some((s) => s.key === "post-tx-balance")).toBe(true);
  });
});
