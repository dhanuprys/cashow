/**
 * One use-case layer (plan §6: "One set of use cases").
 *
 * Server actions, route handlers, the Telegram bot and AI tools all call these
 * services, so validation and invariants live exactly once. Use cases go here;
 * no framework code.
 */

export * from "./accounts";
export * from "./attachments";
export * from "./audit";
export * from "./backup-status";
export * from "./budgets";
export * from "./categories";
export * from "./context";
export * from "./context-pack";
export * from "./defaults";
export * from "./errors";
export * from "./json";
export * from "./notifications";
export * from "./outbox";
export * from "./plans";
export * from "./recurring";
export * from "./result";
export * from "./rules";
export * from "./snapshots";
export * from "./storage";
export * from "./summary";
export * from "./transactions";
export * from "./users";
