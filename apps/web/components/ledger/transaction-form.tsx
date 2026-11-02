"use client";

import { formatAmount, parseMoney } from "@cashow/domain";
import { useActionState, useEffect, useState } from "react";
import { CurrencyInput } from "@/components/ledger/currency-input";
import { DropzoneFileInput } from "@/components/ledger/dropzone-file-input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { createTransactionAction, updateTransactionAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { useClientId } from "@/lib/use-client-id";
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes";
import { cn } from "@/lib/utils";
import { SubmitButton } from "./submit-button";

export interface AccountOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  parentName: string | null;
}

export interface IncomeOption {
  id: string;
  label: string;
  occurredOn: string;
  free: string;
}

export interface AllocationDraft {
  incomeId: string;
  amount: string;
}

export interface PlanItemChoice {
  id: string;
  label: string;
  planName: string;
  outstanding: string;
  dueOn: string | null;
}

export interface TransactionFormInitial {
  id: string;
  type: "INCOME" | "EXPENSE";
  amount: string;
  accountId: string;
  categoryId: string | null;
  planItemId: string | null;
  merchant: string | null;
  counterparty: string | null;
  note: string | null;
  occurredAtLocal: string;
  allocations: AllocationDraft[];
}

export function TransactionForm({
  accounts,
  categories,
  incomes,
  planItems,
  initial,
  defaultPlanItemId,
  defaultType = "EXPENSE",
  defaultAmount,
  defaultAccountId,
  defaultCategoryId,
  defaultMerchant,
  defaultOccurredAtLocal,
  defaultNote,
  timezone,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  incomes: IncomeOption[];
  planItems: PlanItemChoice[];
  initial?: TransactionFormInitial;
  defaultPlanItemId?: string;
  defaultType?: "INCOME" | "EXPENSE";
  defaultAmount?: string;
  defaultAccountId?: string;
  defaultCategoryId?: string;
  defaultMerchant?: string;
  defaultOccurredAtLocal: string;
  defaultNote?: string;
  timezone: string;
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial?.amount ?? defaultAmount ?? "");
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? defaultCategoryId ?? "");
  const [planItemId, setPlanItemId] = useState(initial?.planItemId ?? defaultPlanItemId ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? defaultMerchant ?? "");
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [note, setNote] = useState(initial?.note ?? defaultNote ?? "");
  const [occurredAtLocal, setOccurredAtLocal] = useState(
    initial?.occurredAtLocal ?? defaultOccurredAtLocal,
  );
  const [allocationAmounts, setAllocationAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.allocations ?? []).map((allocation) => [allocation.incomeId, allocation.amount]),
    ),
  );
  const [requestId] = useClientId();

  const [state, formAction] = useActionState<ActionState, FormData>(
    initial === undefined ? createTransactionAction : updateTransactionAction,
    initialActionState,
  );

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: "Tersimpan", description: state.message ?? "Perubahan tersimpan." });
  }, [state]);

  const visibleCategories = categories.filter((category) => category.kind === type);
  const allocationEntries = Object.entries(allocationAmounts).filter(
    ([, value]) => value.trim() !== "",
  );
  const allocationTotal = allocationEntries.reduce((total, [, value]) => {
    return total + (parseMoney(value) ?? 0n);
  }, 0n);
  const amountValue = parseMoney(amount);
  const remaining = (amountValue ?? 0n) - allocationTotal;
  const overAllocated = amountValue !== null && remaining < 0n;

  const initialNote = initial?.note ?? defaultNote ?? "";
  const initialAmount = initial?.amount ?? "";
  const initialAllocations = (initial?.allocations ?? [])
    .filter((allocation) => allocation.amount.trim() !== "")
    .map((allocation) => `${allocation.incomeId}:${allocation.amount.trim()}`)
    .join("|");
  const currentAllocations = allocationEntries
    .map(([incomeId, value]) => `${incomeId}:${value.trim()}`)
    .join("|");
  const dirty =
    amount.trim() !== initialAmount.trim() ||
    note.trim() !== initialNote.trim() ||
    merchant.trim() !== (initial?.merchant ?? "").trim() ||
    counterparty.trim() !== (initial?.counterparty ?? "").trim() ||
    currentAllocations !== initialAllocations;
  useUnsavedChangesGuard(dirty);

  function switchType(next: "INCOME" | "EXPENSE") {
    setType(next);
    if (next === "EXPENSE") setPlanItemId("");
    const selected = categories.find((category) => category.id === categoryId);
    if (selected !== undefined && selected.kind !== next) setCategoryId("");
  }

  function setAllocation(incomeId: string, value: string) {
    setAllocationAmounts((current) => ({ ...current, [incomeId]: value }));
  }

  const allocationsJson = JSON.stringify(
    type === "EXPENSE"
      ? allocationEntries.map(([incomeId, value]) => ({ incomeId, amount: value }))
      : [],
  );

  return (
    <form action={formAction} className="space-y-6">
      {initial === undefined ? null : (
        <input type="hidden" name="transactionId" value={initial.id} />
      )}
      {initial === undefined ? (
        <input type="hidden" name="clientRequestId" value={requestId} />
      ) : null}
      <input type="hidden" name="allocations" value={allocationsJson} />
      <input type="hidden" name="merchant" value={type === "EXPENSE" ? merchant : ""} />
      <input type="hidden" name="counterparty" value={type === "INCOME" ? counterparty : ""} />

      <fieldset className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        <legend className="sr-only">Jenis transaksi</legend>
        {(
          [
            { value: "EXPENSE", label: "Pengeluaran" },
            { value: "INCOME", label: "Pemasukan" },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-full py-2.5 text-center text-sm font-medium transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/70",
              type === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <input
              className="sr-only"
              type="radio"
              name="type"
              value={option.value}
              checked={type === option.value}
              onChange={() => switchType(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="amount">Jumlah</FieldLabel>
          <CurrencyInput
            id="amount"
            name="amount"
            value={amount}
            onValueChange={setAmount}
            placeholder="35rb, 1,5jt, atau 35.000"
            className="mt-2 h-12 text-lg"
            required
            aria-invalid={overAllocated}
          />
          <FieldDescription>
            Tulis angka bebas: <span className="font-medium">35rb</span>,{" "}
            <span className="font-medium">1,5jt</span>, atau{" "}
            <span className="font-medium">35.000</span>.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="accountId">Akun</FieldLabel>
          <NativeSelect
            id="accountId"
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-2 w-full"
            required
          >
            <NativeSelectOption value="">Pilih akun</NativeSelectOption>
            {accounts.map((account) => (
              <NativeSelectOption key={account.id} value={account.id}>
                {account.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="categoryId">Kategori</FieldLabel>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="mt-2 w-full"
          >
            <NativeSelectOption value="">Tanpa kategori</NativeSelectOption>
            {visibleCategories.map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.parentName === null
                  ? category.name
                  : `${category.parentName} · ${category.name}`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {type === "INCOME" ? (
          <Field>
            <FieldLabel htmlFor="planItemId">
              Tahap pembayaran <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <NativeSelect
              id="planItemId"
              name="planItemId"
              value={planItemId}
              onChange={(event) => setPlanItemId(event.target.value)}
              className="mt-2 w-full"
            >
              <NativeSelectOption value="">Tanpa rencana</NativeSelectOption>
              {planItems.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.planName} · {item.label} · sisa {formatAmount(BigInt(item.outstanding))}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Kaitkan pemasukan ini ke tahap proyek yang sedang dibayar.
            </FieldDescription>
          </Field>
        ) : null}

        <Field>
          <FieldLabel htmlFor="occurredAtLocal">Tanggal &amp; waktu</FieldLabel>
          <Input
            id="occurredAtLocal"
            name="occurredAtLocal"
            type="datetime-local"
            value={occurredAtLocal}
            onChange={(event) => setOccurredAtLocal(event.target.value)}
            className="mt-2"
            required
          />
          <FieldDescription>Zona waktu {timezone}</FieldDescription>
        </Field>

        {type === "EXPENSE" ? (
          <Field>
            <FieldLabel htmlFor="merchant">
              Toko / penerima <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <Input
              id="merchant"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              maxLength={120}
              placeholder="Contoh: Indomaret"
              className="mt-2"
            />
          </Field>
        ) : (
          <Field>
            <FieldLabel htmlFor="counterparty">
              Sumber <span className="font-normal text-muted-foreground">(opsional)</span>
            </FieldLabel>
            <Input
              id="counterparty"
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              maxLength={120}
              placeholder="Contoh: Kantor"
              className="mt-2"
            />
          </Field>
        )}

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="note">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Textarea
            id="note"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Catatan transaksi atau rincian tanda terima"
            className="mt-2"
          />
        </Field>
      </FieldGroup>

      {type === "EXPENSE" && incomes.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
          <div>
            <h3 className="text-sm font-medium">Alokasi ke pemasukan</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Opsional. Isi berapa banyak pengeluaran ini memakai uang dari pemasukan tertentu.
            </p>
          </div>
          <p
            className={cn(
              "text-xs font-medium",
              overAllocated ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {amountValue === null
              ? "Sisa belum dihitung"
              : overAllocated
                ? `Kelebihan ${formatAmount(-remaining)}`
                : `Sisa ${formatAmount(remaining)}`}
          </p>

          {incomes.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Belum ada pemasukan yang punya sisa. Catat pemasukan dulu untuk mengaitkan.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {incomes.map((income) => {
                const value = allocationAmounts[income.id] ?? "";
                return (
                  <li
                    key={income.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{income.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {income.occurredOn} · sisa {formatAmount(BigInt(income.free))}
                      </p>
                    </div>
                    <CurrencyInput
                      aria-label={`Alokasi dari ${income.label}`}
                      value={value}
                      onValueChange={(val) => setAllocation(income.id, val)}
                      placeholder="0"
                      className="w-full sm:w-36"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      {initial === undefined ? (
        <div className="space-y-2">
          <FieldLabel htmlFor="attachment">
            Bukti <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <DropzoneFileInput
            id="attachment"
            name="attachment"
            accept="image/*,application/pdf"
            maxSizeBytes={10 * 1024 * 1024}
            description="Tarik struk atau bukti pembayaran ke sini, atau klik untuk memilih"
          />
          <FieldDescription>Foto struk atau PDF. Maksimal 10 MB.</FieldDescription>
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <SubmitButton className="w-full" size="lg">
          {initial === undefined ? "Simpan transaksi" : "Simpan perubahan"}
        </SubmitButton>
      </div>
    </form>
  );
}
