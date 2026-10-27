"use client";

import { formatAmount, parseMoney } from "@cashow/domain";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createTransactionAction, updateTransactionAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
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
  defaultOccurredAtLocal,
  timezone,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  incomes: IncomeOption[];
  planItems: PlanItemChoice[];
  initial?: TransactionFormInitial;
  defaultPlanItemId?: string;
  defaultType?: "INCOME" | "EXPENSE";
  defaultOccurredAtLocal: string;
  timezone: string;
}) {
  const [type, setType] = useState<"INCOME" | "EXPENSE">(initial?.type ?? defaultType);
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [planItemId, setPlanItemId] = useState(initial?.planItemId ?? defaultPlanItemId ?? "");
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [occurredAtLocal, setOccurredAtLocal] = useState(
    initial?.occurredAtLocal ?? defaultOccurredAtLocal,
  );
  const [allocationAmounts, setAllocationAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (initial?.allocations ?? []).map((allocation) => [allocation.incomeId, allocation.amount]),
    ),
  );
  const [requestId] = useState(() => crypto.randomUUID());

  const [state, formAction] = useActionState<ActionState, FormData>(
    initial === undefined ? createTransactionAction : updateTransactionAction,
    initialActionState,
  );

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
              "cursor-pointer rounded-full py-2 text-center text-sm font-medium transition-colors",
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="amount">Jumlah</Label>
          <Input
            id="amount"
            name="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="35rb, 1,5jt, Rp 35.000"
            className="mt-2 h-12 text-lg"
            required
            aria-invalid={overAllocated}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Tulis angka bebas: <span className="font-medium">35rb</span>,{" "}
            <span className="font-medium">1,5jt</span>, atau{" "}
            <span className="font-medium">Rp 35.000</span>.
          </p>
        </div>

        <div>
          <Label htmlFor="accountId">Akun</Label>
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
        </div>

        <div>
          <Label htmlFor="categoryId">Kategori</Label>
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
        </div>

        {type === "INCOME" ? (
          <div>
            <Label htmlFor="planItemId">
              Tahap pembayaran <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
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
            <p className="mt-1.5 text-xs text-muted-foreground">
              Kaitkan pemasukan ini ke tahap proyek yang sedang dibayar.
            </p>
          </div>
        ) : null}

        <div>
          <Label htmlFor="occurredAtLocal">Tanggal &amp; waktu</Label>
          <Input
            id="occurredAtLocal"
            name="occurredAtLocal"
            type="datetime-local"
            value={occurredAtLocal}
            onChange={(event) => setOccurredAtLocal(event.target.value)}
            className="mt-2"
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Zona waktu {timezone}</p>
        </div>

        {type === "EXPENSE" ? (
          <div>
            <Label htmlFor="merchant">
              Toko / penerima <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="merchant"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              maxLength={120}
              placeholder="Contoh: Indomaret"
              className="mt-2"
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="counterparty">
              Sumber <span className="font-normal text-muted-foreground">(opsional)</span>
            </Label>
            <Input
              id="counterparty"
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              maxLength={120}
              placeholder="Contoh: Kantor"
              className="mt-2"
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Label htmlFor="note">
            Catatan <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Textarea
            id="note"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Keterangan singkat"
            className="mt-2"
          />
        </div>
      </div>

      {type === "EXPENSE" ? (
        <section className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Tarik dari pemasukan</h2>
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
          </div>

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
                    <Input
                      aria-label={`Alokasi dari ${income.label}`}
                      value={value}
                      onChange={(event) => setAllocation(income.id, event.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className="w-32"
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

      <SubmitButton className="w-full" size="lg">
        {initial === undefined ? "Simpan transaksi" : "Simpan perubahan"}
      </SubmitButton>
    </form>
  );
}
