/**
 * Prompts, tools (thin wrappers over services) and evals (section 4).
 *
 * The model reasons; code calculates. Tools return computed results and never
 * expose raw SQL or raw rows beyond a capped window.
 */

/** A read tool exposed to the chat model. Write tools produce drafts only. */
export interface AiTool {
  readonly name: string;
  readonly description: string;
}
