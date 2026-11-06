import { describe, expect, it } from "bun:test";
import { generateText, stepCountIs, tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

const usage = {
  inputTokens: {
    total: 12,
    noCache: 12,
    cacheRead: 0,
    cacheWrite: 0,
  },
  outputTokens: {
    total: 4,
    text: 0,
    reasoning: 0,
  },
};

const createTransaction = (onExecute: () => void) =>
  tool({
    inputSchema: z.object({ amount: z.string() }),
    execute: async () => {
      onExecute();
      return { status: "created" };
    },
  });

const createBatchTransactions = (onExecute: (count: number) => void) =>
  tool({
    inputSchema: z.object({
      accountName: z.string().optional(),
      transactions: z.array(z.object({ amount: z.string(), note: z.string() })),
    }),
    execute: async (input) => {
      onExecute(input.transactions.length);
      return { status: "created", count: input.transactions.length };
    },
  });

describe("write-tool approval gate", () => {
  it("requests approval instead of executing the tool", async () => {
    let executed = 0;
    const model = new MockLanguageModelV3({
      doGenerate: {
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "createTransaction",
            input: JSON.stringify({ amount: "25000" }),
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage,
        warnings: [],
      },
    });

    const result = await generateText({
      model,
      messages: [{ role: "user", content: "catat kopi 25rb" }],
      tools: { createTransaction: createTransaction(() => (executed += 1)) },
      toolApproval: { createTransaction: "user-approval" },
    });

    expect(executed).toBe(0);
    const approvals = result.content.filter((part) => part.type === "tool-approval-request");
    expect(approvals).toHaveLength(1);
  });

  it("gates a batch of transactions behind a single approval", async () => {
    let executed = 0;
    const model = new MockLanguageModelV3({
      doGenerate: {
        content: [
          {
            type: "tool-call",
            toolCallId: "call-batch",
            toolName: "createBatchTransactions",
            input: JSON.stringify({
              accountName: "BCA",
              transactions: [
                { amount: "53000", note: "bensin" },
                { amount: "25000", note: "kopi" },
                { amount: "120000", note: "belanja" },
              ],
            }),
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage,
        warnings: [],
      },
    });

    const result = await generateText({
      model,
      messages: [{ role: "user", content: "catat pengeluaran 1 november" }],
      tools: { createBatchTransactions: createBatchTransactions((count) => (executed += count)) },
      toolApproval: { createBatchTransactions: "user-approval" },
    });

    expect(executed).toBe(0);
    const approvals = result.content.filter((part) => part.type === "tool-approval-request");
    expect(approvals).toHaveLength(1);
  });

  it("executes once an approval response is replayed and lets the model summarize", async () => {
    let executed = 0;
    const model = new MockLanguageModelV3({
      doGenerate: [
        {
          content: [{ type: "text", text: "Transaksi 25rb berhasil dicatat!" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage,
          warnings: [],
        },
      ],
    });

    const result = await generateText({
      model,
      messages: [
        { role: "user", content: "catat kopi 25rb" },
        {
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "createTransaction",
              input: { amount: "25000" },
            },
            {
              type: "tool-approval-request",
              approvalId: "approval-1",
              toolCallId: "call-1",
            },
          ],
        },
        {
          role: "tool",
          content: [
            {
              type: "tool-approval-response",
              approvalId: "approval-1",
              approved: true,
            },
          ],
        },
      ],
      tools: { createTransaction: createTransaction(() => (executed += 1)) },
      toolApproval: { createTransaction: "user-approval" },
      stopWhen: stepCountIs(2),
    });

    expect(executed).toBe(1);
    expect(result.text).toBe("Transaksi 25rb berhasil dicatat!");
    expect(result.content.some((part) => part.type === "tool-approval-request")).toBe(false);
  });
});
