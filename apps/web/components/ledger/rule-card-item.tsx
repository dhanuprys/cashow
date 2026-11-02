"use client";

import { AlertCircle, Clock, Power, Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteRuleAction, updateRuleAction } from "@/lib/actions/ledger";
import { displayDateTime } from "@/lib/format";
import { describeRuleCondition, describeRuleTrigger, RULE_SEVERITY } from "@/lib/rule-helpers";

export interface RuleItem {
  id: string;
  name: string;
  description: string | null;
  trigger: unknown;
  condition: unknown;
  actions: unknown;
  settings: unknown;
  active: boolean;
  version: number;
  lastFiredAt?: string | null;
  lastEvaluatedAt?: string | null;
}

interface RuleCardItemProps {
  rule: RuleItem;
  timezone?: string;
}

export function RuleCardItem({ rule, timezone = "Asia/Jakarta" }: RuleCardItemProps) {
  const triggerText = describeRuleTrigger(rule.trigger);
  const conditionText = describeRuleCondition(rule.condition);

  const settings = (rule.settings ?? {}) as {
    severity?: string;
    cooldownMinutes?: number;
    edgeTriggered?: boolean;
  };
  const severityInfo = RULE_SEVERITY[settings.severity ?? "INFO"] ?? RULE_SEVERITY.INFO;

  return (
    <Card className={!rule.active ? "opacity-70 bg-muted/20" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-base text-foreground">{rule.name}</span>
              <Badge variant={rule.active ? "default" : "outline"} className="text-[10px]">
                {rule.active ? "Aktif" : "Nonaktif"}
              </Badge>
              {settings.severity && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${severityInfo.color}`}
                >
                  {severityInfo.label}
                </span>
              )}
            </div>
            {rule.description && (
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Toggle Active Form */}
            <form action={updateRuleAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <input type="hidden" name="active" value={rule.active ? "false" : "true"} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                title={rule.active ? "Jeda aturan" : "Aktifkan aturan"}
              >
                <Power
                  className={`size-3.5 ${rule.active ? "text-emerald-600" : "text-muted-foreground"}`}
                />
                {rule.active ? "Jeda" : "Nyalakan"}
              </Button>
            </form>

            {/* Delete Rule Form */}
            <form action={deleteRuleAction}>
              <input type="hidden" name="ruleId" value={rule.id} />
              <ConfirmSubmitButton
                message={`Hapus aturan "${rule.name}"?`}
                variant="ghost"
                size="sm"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>

        {/* Visual condition badge container */}
        <div className="rounded-lg border bg-muted/40 p-2.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5 text-primary" />
            <span>Pemicu:</span>
            <span className="font-medium text-foreground">{triggerText}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertCircle className="size-3.5 text-amber-600" />
            <span>Kondisi:</span>
            <span className="font-medium text-foreground">{conditionText}</span>
          </div>
        </div>

        {/* Firing & evaluation history audit footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
          <span>
            {rule.lastEvaluatedAt
              ? `Dievaluasi ${displayDateTime(rule.lastEvaluatedAt, timezone)}`
              : "Belum pernah dievaluasi"}
          </span>
          <span>
            {rule.lastFiredAt ? (
              <span className="text-amber-700 dark:text-amber-400 font-medium">
                Pernah terpicu {displayDateTime(rule.lastFiredAt, timezone)}
              </span>
            ) : (
              "Belum pernah terpicu"
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
