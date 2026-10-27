/**
 * Pure rule evaluation (plan §5). A rule is a trigger, a condition and actions,
 * stored as validated JSON and evaluated by a pure function over a metrics
 * registry. There is no `eval` and no user code.
 */

export type RuleOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";

export type RuleValue =
  | number
  | { metric: string }
  | { percentOf: string }
  | { multipleOf: string };

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
  if ("percentOf" in value) return ((metrics[value.percentOf] ?? 0) * 1) / 100; // percent already? treat as raw
  if ("multipleOf" in value) return (metrics[value.multipleOf] ?? 0) * 1;
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
