/**
 * Pure rule evaluation (plan §5). A rule is a trigger, a condition and actions,
 * stored as validated JSON and evaluated by a pure function over a metrics
 * registry. There is no `eval` and no user code.
 */

export type RuleOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type RuleValue =
  | number
  | { metric: string }
  | { percentOf: string; percent?: number }
  | { multipleOf: string; times?: number };

export type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | { metric: string; op: RuleOp; value: RuleValue };

export type RuleTrigger =
  | { type: "transaction"; filters?: { type?: string; categoryId?: string; accountId?: string } }
  | { type: "schedule"; cron?: string }
  | { type: "snapshot" }
  | { type: "planItem" }
  | { type: "metricThreshold"; metric: string };

export interface RuleDefinition {
  trigger: RuleTrigger;
  condition: RuleCondition;
}

const OPS: Record<RuleOp, (a: number, b: number) => boolean> = {
  eq: (a, b) => a === b,
  ne: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

function resolveValue(value: RuleValue, metrics: Record<string, number>): number {
  if (typeof value === "number") return value;
  if ("metric" in value) return metrics[value.metric] ?? 0;
  // `{ percentOf: "incomeMonth" }` means "N percent of that metric": the
  // comparison uses `{ metric: "expenseMonth", op: "gt", value: { percentOf: "incomeMonth" } }`
  // with the percentage supplied as a sibling `percent` field.
  if ("percentOf" in value) {
    const percent = "percent" in value && typeof value.percent === "number" ? value.percent : 100;
    return ((metrics[value.percentOf] ?? 0) * percent) / 100;
  }
  if ("multipleOf" in value) {
    const times = "times" in value && typeof value.times === "number" ? value.times : 1;
    return (metrics[value.multipleOf] ?? 0) * times;
  }
  return 0;
}

export function evaluateCondition(
  condition: RuleCondition,
  metrics: Record<string, number>,
): boolean {
  if ("all" in condition) {
    return condition.all.every((c) => evaluateCondition(c, metrics));
  }
  if ("any" in condition) {
    return condition.any.some((c) => evaluateCondition(c, metrics));
  }
  if ("not" in condition) {
    return !evaluateCondition(condition.not, metrics);
  }
  const left = metrics[condition.metric] ?? 0;
  const right = resolveValue(condition.value, metrics);
  const op = OPS[condition.op];
  return op === undefined ? false : op(left, right);
}

export function evaluateRule(condition: RuleCondition, metrics: Record<string, number>): boolean {
  return evaluateCondition(condition, metrics);
}

/**
 * Map an outbox event name onto the rule trigger family it should wake.
 * `transaction.created` → `transaction`, `balance_snapshot.created` → `snapshot`,
 * `payment_plan_item.updated` → `planItem`, anything else → itself.
 */
export function triggerFamilyOf(eventType: string): string {
  if (eventType.startsWith("transaction.") || eventType.startsWith("transfer.")) {
    return "transaction";
  }
  if (eventType.startsWith("balance_snapshot.")) return "snapshot";
  if (eventType.startsWith("payment_plan_item.")) return "planItem";
  if (eventType.startsWith("payment_plan.")) return "planItem";
  return eventType;
}

/** Trigger families evaluated on every worker tick, regardless of events. */
export const SCHEDULED_TRIGGERS = ["schedule", "metricThreshold"] as const;

export function triggerMatches(trigger: unknown, families: readonly string[]): boolean {
  const type = (trigger as { type?: unknown } | null)?.type;
  if (typeof type !== "string") return true;
  return families.includes(type) || families.includes(triggerFamilyOf(type));
}
