"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { updateSettingsAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface ProfileValues {
  name: string;
  timezone: string;
  weekStartsOn: number;
  budgetMonthStartDay: number;
  currency: string;
}

const ZONES = [
  { value: "Asia/Jakarta", label: "WIB · Asia/Jakarta" },
  { value: "Asia/Makassar", label: "WITA · Asia/Makassar" },
  { value: "Asia/Jayapura", label: "WIT · Asia/Jayapura" },
];

const WEEK_STARTS = [
  { value: "1", label: "Senin" },
  { value: "0", label: "Minggu" },
  { value: "6", label: "Sabtu" },
];

export function SettingsForm({ profile }: { profile: ProfileValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    initialActionState,
  );
  const knownZone = ZONES.some((zone) => zone.value === profile.timezone);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="settings-name">
            Nama <span className="font-normal text-muted-foreground">(opsional)</span>
          </Label>
          <Input
            id="settings-name"
            name="name"
            defaultValue={profile.name}
            maxLength={80}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="settings-timezone">Zona waktu</Label>
          <NativeSelect
            id="settings-timezone"
            name="timezone"
            defaultValue={profile.timezone}
            className="mt-2 w-full"
          >
            {knownZone ? null : (
              <NativeSelectOption value={profile.timezone}>{profile.timezone}</NativeSelectOption>
            )}
            {ZONES.map((zone) => (
              <NativeSelectOption key={zone.value} value={zone.value}>
                {zone.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Dipakai untuk tanggal buku dan laporan. Tanggal lama tidak ditulis ulang.
          </p>
        </div>

        <div>
          <Label htmlFor="settings-currency">Mata uang</Label>
          <Input
            id="settings-currency"
            name="currency"
            defaultValue={profile.currency}
            maxLength={3}
            className="mt-2 uppercase"
          />
        </div>

        <div>
          <Label htmlFor="settings-week">Awal minggu</Label>
          <NativeSelect
            id="settings-week"
            name="weekStartsOn"
            defaultValue={String(profile.weekStartsOn)}
            className="mt-2 w-full"
          >
            {WEEK_STARTS.map((day) => (
              <NativeSelectOption key={day.value} value={day.value}>
                {day.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div>
          <Label htmlFor="settings-budget-day">Tanggal mulai bulan anggaran</Label>
          <Input
            id="settings-budget-day"
            name="budgetMonthStartDay"
            type="number"
            min={1}
            max={28}
            defaultValue={profile.budgetMonthStartDay}
            className="mt-2"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Misalnya 25 kalau gajian tanggal 25.
          </p>
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Pengaturan tersimpan.</p>
      ) : null}

      <SubmitButton size="sm">Simpan pengaturan</SubmitButton>
    </form>
  );
}
