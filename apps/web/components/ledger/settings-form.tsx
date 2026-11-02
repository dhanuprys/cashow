"use client";

import { SUPPORTED_CURRENCIES } from "@cashow/domain";
import { Clock, Sparkles, UserCheck } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { toast } from "@/components/ui/toast";
import { UserAvatar } from "@/components/ui/user-avatar";
import { updateSettingsAction } from "@/lib/actions/ledger";
import { type ActionState, initialActionState } from "@/lib/actions/state";
import { SubmitButton } from "./submit-button";

export interface ProfileValues {
  name: string;
  avatar?: string | null;
  bio?: string | null;
  timezone: string;
  weekStartsOn: number;
  budgetMonthStartDay: number;
  currency: string;
  email?: string | null;
}

const ZONES = [
  { value: "Asia/Jakarta", label: "WIB · Asia/Jakarta (UTC+7)" },
  { value: "Asia/Makassar", label: "WITA · Asia/Makassar (UTC+8)" },
  { value: "Asia/Jayapura", label: "WIT · Asia/Jayapura (UTC+9)" },
];

const WEEK_STARTS = [
  { value: "1", label: "Senin (Standar ISO / Indonesia)" },
  { value: "0", label: "Minggu" },
  { value: "6", label: "Sabtu" },
];

function getTimeInZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function SettingsForm({ profile }: { profile: ProfileValues }) {
  const [currency, setCurrency] = useState(profile.currency);
  const [selectedZone, setSelectedZone] = useState(profile.timezone);
  const [budgetDay, setBudgetDay] = useState(profile.budgetMonthStartDay);
  const [avatar, setAvatar] = useState(profile.avatar || "alex");
  const [name, setName] = useState(profile.name || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [currentTime, setCurrentTime] = useState("");

  const [state, formAction] = useActionState<ActionState, FormData>(
    updateSettingsAction,
    initialActionState,
  );

  const nameId = useId();
  const bioId = useId();
  const timezoneId = useId();
  const currencyId = useId();
  const weekId = useId();
  const budgetDayId = useId();

  // Update current time display every 5 seconds
  useEffect(() => {
    const updateTime = () => setCurrentTime(getTimeInZone(selectedZone));
    updateTime();
    const timer = setInterval(updateTime, 5000);
    return () => clearInterval(timer);
  }, [selectedZone]);

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({
      title: "Pengaturan Tersimpan",
      description: state.message ?? "Preferensi profil dan buku kas berhasil diperbarui.",
    });
  }, [state]);

  const knownZone = ZONES.some((zone) => zone.value === profile.timezone);

  // Calculate budget period preview
  const budgetDayNumber = Number(budgetDay) || 1;
  const prevDay = budgetDayNumber === 1 ? "akhir bulan" : `tanggal ${budgetDayNumber - 1}`;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="avatar" value={avatar} />

      {/* Account Identity Summary Card with Live Avatar Preview */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <UserAvatar avatar={avatar} name={name} size="lg" className="shadow-sm" />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-semibold text-foreground">
                {name || "Pemilik Buku Kas"}
              </p>
              <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                <UserCheck
                  className="size-3 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Terverifikasi
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {profile.email ?? "Tanpa email terdaftar"}
            </p>
            {bio ? (
              <p className="line-clamp-1 text-xs italic text-muted-foreground/90">"{bio}"</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Flat Illustrated Avatar Selector */}
      <div className="space-y-2">
        <FieldLabel>Pilih Ilustrasi Avatar</FieldLabel>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>

      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {/* Full Name Field */}
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={nameId}>
            Nama Lengkap / Panggilan{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Input
            id={nameId}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="misal: Dhanu Pratama"
            className="mt-1.5"
          />
          <FieldDescription>
            Nama lengkap atau nama panggilan yang ditampilkan pada dasbor dan laporan.
          </FieldDescription>
        </Field>

        {/* Bio / Catatan Profil (Optional) */}
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={bioId}>
            Bio / Catatan Pribadi{" "}
            <span className="font-normal text-muted-foreground">(opsional)</span>
          </FieldLabel>
          <Input
            id={bioId}
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={250}
            placeholder="misal: Menabung untuk dana darurat & investasi masa depan."
            className="mt-1.5"
          />
          <FieldDescription>
            Catatan singkat motivasi finansial atau status personal Anda.
          </FieldDescription>
        </Field>

        {/* Currency Field */}
        <Field>
          <FieldLabel htmlFor={currencyId}>Mata Uang Buku</FieldLabel>
          <NativeSelect
            id={currencyId}
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1.5 w-full"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            Standar mata uang seluruh akun keuangan dan mutasi transaksi.
          </FieldDescription>
        </Field>

        {/* Timezone Field + Live Clock */}
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor={timezoneId}>Zona Waktu</FieldLabel>
            {currentTime && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" />
                {currentTime}
              </span>
            )}
          </div>
          <NativeSelect
            id={timezoneId}
            name="timezone"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="mt-1.5 w-full"
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
          <FieldDescription>
            Menentukan penanggalan entri mutasi dan filter periode laporan.
          </FieldDescription>
        </Field>

        {/* Week Starts On */}
        <Field>
          <FieldLabel htmlFor={weekId}>Hari Awal Minggu</FieldLabel>
          <NativeSelect
            id={weekId}
            name="weekStartsOn"
            defaultValue={String(profile.weekStartsOn)}
            className="mt-1.5 w-full"
          >
            {WEEK_STARTS.map((day) => (
              <NativeSelectOption key={day.value} value={day.value}>
                {day.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldDescription>
            Menentukan kolom awal kalender dan perhitungan rekap mingguan.
          </FieldDescription>
        </Field>

        {/* Budget Month Start Day + Interactive Preview */}
        <Field>
          <FieldLabel htmlFor={budgetDayId}>Tanggal Awal Siklus Anggaran</FieldLabel>
          <Input
            id={budgetDayId}
            name="budgetMonthStartDay"
            type="number"
            min={1}
            max={28}
            value={budgetDay}
            onChange={(e) => setBudgetDay(Number(e.target.value))}
            className="mt-1.5"
          />
          <FieldDescription>
            Siklus anggaran berjalan dari <strong>tgl {budgetDayNumber}</strong> hingga{" "}
            <strong>{prevDay}</strong>.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {/* Cycle Highlight Card */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground flex items-center gap-2.5">
        <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          Tip: Jika tanggal gajian Anda adalah tanggal 25, atur tanggal mulai anggaran ke{" "}
          <strong>25</strong> agar batas alokasi bulanan akurat mengikuti siklus arus kas masuk
          Anda.
        </p>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none flex items-center justify-end">
        <SubmitButton size="sm" className="w-full sm:w-auto font-medium shadow-2xs">
          Simpan Perubahan
        </SubmitButton>
      </div>
    </form>
  );
}
