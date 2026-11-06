"use client";

import { formatMoney } from "@cashow/domain";
import { Pencil, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { ConfirmSubmitButton } from "@/components/ledger/confirm-submit-button";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { DatePicker } from "@/components/ledger/date-picker";
import { SubmitButton } from "@/components/ledger/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  addGoalReservationAction,
  createGoalAction,
  removeGoalReservationAction,
  updateGoalAction,
} from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { cn } from "@/lib/utils";

export interface GoalAccountOption {
  id: string;
  name: string;
  /** Cash left after every live goal reservation on this account. */
  free: bigint;
}

const GOAL_TEMPLATES = [
  {
    icon: "🛡️",
    name: "Dana Darurat",
    target: "15000000",
    desc: "Cadangan 3-6 bulan biaya hidup darurat",
  },
  {
    icon: "✈️",
    name: "Liburan & Healing",
    target: "6000000",
    desc: "Tiket pesawat, hotel, dan biaya jalan-jalan",
  },
  {
    icon: "💻",
    name: "Gadget & Alat Kerja",
    target: "12000000",
    desc: "Upgrade laptop atau perangkat penunjang produktivitas",
  },
  {
    icon: "🚗",
    name: "Pajak & Servis Kendaraan",
    target: "3000000",
    desc: "Biaya servis rutin dan pajak tahunan kendaraan",
  },
];

export function GoalForm({
  goal,
  onSuccess,
}: {
  goal?: {
    id: string;
    name: string;
    description: string | null;
    targetAmount: string;
    targetDate: string | null;
    status: string;
  };
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    goal === undefined ? createGoalAction : updateGoalAction,
    initialActionState,
  );

  const [formValues, setFormValues] = useState({
    name: goal?.name ?? "",
    targetAmount: goal?.targetAmount ?? "",
    description: goal?.description ?? "",
  });

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: goal === undefined ? "Target Dibuat" : "Target Diperbarui",
      description: state.message ?? "Target tabungan berhasil disimpan.",
    });
    onSuccess?.();
  }, [state, goal, onSuccess]);

  const applyTemplate = (tpl: (typeof GOAL_TEMPLATES)[number]) => {
    setFormValues({
      name: tpl.name,
      targetAmount: tpl.target,
      description: tpl.desc,
    });
  };

  return (
    <form action={formAction} className="space-y-4">
      {goal !== undefined ? <input type="hidden" name="goalId" value={goal.id} /> : null}

      {/* Quick templates for new goals */}
      {goal === undefined && (
        <div className="space-y-1.5 pb-1">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3 text-primary" aria-hidden="true" />
            <span>Inspirasi target cepat:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:bg-muted/80 hover:text-foreground transition-all cursor-pointer"
              >
                <span>{tpl.icon}</span>
                <span>{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="goal-name">Nama Target</FieldLabel>
          <Input
            id="goal-name"
            name="name"
            value={formValues.name}
            onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="cth. Dana Darurat, Beli Laptop, Liburan"
            required
            className="mt-1"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="goal-targetAmount">Target Nominal</FieldLabel>
          <CurrencyInput
            id="goal-targetAmount"
            name="targetAmount"
            value={formValues.targetAmount}
            onValueChange={(val) => setFormValues((v) => ({ ...v, targetAmount: val }))}
            placeholder="cth. 10jt atau 10.000.000"
            presets={["1000000", "5000000", "10000000", "20000000", "50000000"]}
            required
            className="mt-1"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="goal-targetDate">Batas Waktu (Opsional)</FieldLabel>
          <div className="mt-1">
            <DatePicker
              name="targetDate"
              defaultValue={goal?.targetDate ?? ""}
              ariaLabel="Batas waktu target tabungan"
            />
          </div>
        </Field>

        {goal !== undefined ? (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="goal-status">Status Target</FieldLabel>
            <NativeSelect
              id="goal-status"
              name="status"
              defaultValue={goal.status}
              className="mt-1 w-full"
            >
              <NativeSelectOption value="ACTIVE">Aktif (Sedang berjalan)</NativeSelectOption>
              <NativeSelectOption value="PAUSED">Dijeda (Alokasi tetap aman)</NativeSelectOption>
              <NativeSelectOption value="COMPLETED">Tercapai (Target selesai)</NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : null}

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="goal-description">
            Catatan Motivasi <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id="goal-description"
            name="description"
            value={formValues.description}
            onChange={(e) => setFormValues((v) => ({ ...v, description: e.target.value }))}
            placeholder="Catatan tujuan atau pengingat mengapa target ini penting…"
            maxLength={1000}
            className="mt-1"
          />
        </Field>
      </FieldGroup>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end pt-2">
        <SubmitButton
          size="sm"
          className="w-full sm:w-auto"
          pendingLabel={goal === undefined ? "Membuat target…" : "Menyimpan…"}
        >
          {goal === undefined ? "Buat Target" : "Simpan Perubahan"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function CreateGoalDialog({
  label = "Target Baru",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("gap-1.5 cursor-pointer text-xs h-9", className)}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span>{label}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg sm:rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Target className="size-4 text-primary" aria-hidden="true" />
              <span>Buat Target Tabungan Baru</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tentukan target impian Anda. Saldo rekening bank tetap utuh dan sesuai kenyataan.
            </DialogDescription>
          </DialogHeader>

          <GoalForm onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditGoalDialog({
  goal,
}: {
  goal: {
    id: string;
    name: string;
    description: string | null;
    targetAmount: string;
    targetDate: string | null;
    status: string;
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label={`Ubah target ${goal.name}`}
      >
        <Pencil className="size-3" aria-hidden="true" />
        <span>Ubah</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-lg sm:rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Pencil className="size-4 text-primary" aria-hidden="true" />
              <span>Ubah Target Tabungan</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Sesuaikan nama, target nominal, batas waktu, atau status pencapaian target.
            </DialogDescription>
          </DialogHeader>

          <GoalForm goal={goal} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReserveGoalDialog({
  goalId,
  goalName,
  accounts,
  remainingAmount,
  monthlyPacing,
  compact = false,
}: {
  goalId: string;
  goalName: string;
  accounts: GoalAccountOption[];
  remainingAmount?: bigint;
  monthlyPacing?: bigint | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [depositAmount, setDepositAmount] = useState<string>("");

  const [state, formAction] = useActionState<ActionState, FormData>(
    addGoalReservationAction,
    initialActionState,
  );

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]?.id ?? "");
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: "Dana Dicadangkan",
      description: state.message ?? "Berhasil mencadangkan dana untuk target.",
    });
    setDepositAmount("");
    setOpen(false);
  }, [state]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <>
      {compact ? (
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setOpen(true)}
          disabled={accounts.length === 0}
          title={
            accounts.length === 0
              ? "Semua saldo bebas rekening sudah dicadangkan"
              : `Sisihkan dana untuk ${goalName}`
          }
          className="gap-1 text-[11px] h-6 px-2 cursor-pointer text-muted-foreground hover:text-foreground shrink-0"
        >
          <Plus className="size-3" aria-hidden="true" />
          <span>Sisihkan</span>
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={accounts.length === 0}
          title={accounts.length === 0 ? "Semua saldo bebas rekening sudah dicadangkan" : undefined}
          className="gap-1.5 cursor-pointer text-xs h-8"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>Sisihkan Dana</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-md sm:rounded-2xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <Target className="size-4 text-primary" aria-hidden="true" />
              <span>Sisihkan Dana: {goalName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              Saldo rekening bank Anda tetap 100% utuh di m-Banking. Dana hanya dicadangkan di
              Cashow agar terlindungi dari pengeluaran harian.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="goalId" value={goalId} />

            <Field>
              <FieldLabel htmlFor="res-accountId">Sumber Rekening / Dompet</FieldLabel>
              {accounts.length === 0 ? (
                <p className="mt-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Tidak ada rekening dengan saldo bebas yang cukup. Lepas sebagian cadangan target
                  lain atau tambah saldo akun.
                </p>
              ) : (
                <NativeSelect
                  id="res-accountId"
                  name="accountId"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                  className="mt-1 w-full"
                >
                  {accounts.map((a) => (
                    <NativeSelectOption key={a.id} value={a.id}>
                      {a.name} — Saldo Bebas: {formatMoney(a.free)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
              {selectedAccount && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Maksimal alokasi dari akun ini:{" "}
                  <strong className="text-foreground tabular-nums">
                    {formatMoney(selectedAccount.free)}
                  </strong>
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="res-amount">Jumlah yang Dicadangkan</FieldLabel>

              {/* Smart shortcut chips */}
              <div className="flex flex-wrap gap-1.5 mt-1 mb-1.5">
                {remainingAmount !== undefined && remainingAmount > 0n && (
                  <button
                    type="button"
                    onClick={() => setDepositAmount(remainingAmount.toString())}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                  >
                    <span>Sisa Target:</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(remainingAmount)}
                    </span>
                  </button>
                )}
                {monthlyPacing !== undefined && monthlyPacing !== null && monthlyPacing > 0n && (
                  <button
                    type="button"
                    onClick={() => setDepositAmount(monthlyPacing.toString())}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>Saran Bulanan:</span>
                    <span className="font-semibold tabular-nums">{formatMoney(monthlyPacing)}</span>
                  </button>
                )}
              </div>

              <CurrencyInput
                id="res-amount"
                name="amount"
                value={depositAmount}
                onValueChange={setDepositAmount}
                placeholder="cth. 500rb atau 1.000.000"
                presets={["100000", "250000", "500000", "1000000", "2000000"]}
                required
                className="mt-1"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="res-note">
                Catatan Alokasi{" "}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </FieldLabel>
              <Input
                id="res-note"
                name="note"
                placeholder="cth. Sisihan awal bulan, bonus proyek"
                className="mt-1"
              />
            </Field>

            {state.status === "error" ? (
              <p
                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {state.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <SubmitButton size="sm" disabled={accounts.length === 0} pendingLabel="Mencadangkan…">
                Simpan Cadangan
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteReservationButton({
  reservationId,
  amount,
  accountName,
}: {
  reservationId: string;
  amount: bigint;
  accountName: string;
}) {
  return (
    <form action={removeGoalReservationAction} className="inline-flex">
      <input type="hidden" name="reservationId" value={reservationId} />
      <ConfirmSubmitButton
        variant="ghost"
        size="icon-xs"
        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
        message={`Lepaskan cadangan dana ${formatMoney(amount)} dari ${accountName} kembali ke saldo bebas? Saldo bank Anda tetap utuh.`}
        aria-label={`Lepaskan cadangan dana ${formatMoney(amount)} dari ${accountName}`}
        title="Kembalikan dana ke saldo bebas"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </ConfirmSubmitButton>
    </form>
  );
}
