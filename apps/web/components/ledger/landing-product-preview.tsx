import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Eye,
  LockKey,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";

export function LandingProductPreview() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* App window frame header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </div>
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            app.cashow.local / ringkasan
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
            <LockKey className="size-3 text-primary" />
            Server Lokal
          </span>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* Workspace Top Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Buku Kas Utama · Oktober 2026
            </p>
            <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Ringkasan Keuangan
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1 font-mono text-xs text-foreground">
              <CheckCircle className="size-3.5 text-primary" weight="fill" />
              Buku Kas Seimbang
            </span>
          </div>
        </div>

        {/* 4 Stat KPI Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Saldo</span>
              <Eye className="size-3.5" />
            </div>
            <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Rp 18.420.000
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">3 rekening aktif</p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Uang Masuk</span>
              <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-xl">
              Rp 14.500.000
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">2 sumber dana</p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pengeluaran</span>
              <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Rp 10.350.000
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">18 catatan mutasi</p>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Bebas Belanja</span>
              <Wallet className="size-3.5 text-primary" />
            </div>
            <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-primary sm:text-xl">
              Rp 4.150.000
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Batas Rp 295.000 / hari</p>
          </div>
        </div>

        {/* 2 Column Content Workspace */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Recent Ledger Entries */}
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Buku Mutasi Terbaru
              </span>
              <span className="font-mono text-xs text-muted-foreground">Status: Sah</span>
            </div>

            <div className="divide-y divide-border">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ArrowDownLeft className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Pendapatan Proyek Desain</p>
                    <p className="text-xs text-muted-foreground">Rekening Utama · 30 Okt</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  +Rp 6.500.000
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ArrowUpRight className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Belanja Bahan Dapur</p>
                    <p className="text-xs text-muted-foreground">Pos Kebutuhan Pokok · 29 Okt</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-foreground">Rp 420.000</span>
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <ArrowUpRight className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Sambungan Wifi Rumah</p>
                    <p className="text-xs text-muted-foreground">Pos Tagihan Rutin · 28 Okt</p>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-foreground">Rp 385.000</span>
              </div>
            </div>
          </div>

          {/* Right Column: Envelope Allocations & AI Insight */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Alokasi Amplop Aktif
              </p>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">Kebutuhan Pokok</span>
                    <span className="font-mono text-muted-foreground">93%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[93%] rounded-full bg-primary" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">Dana Darurat</span>
                    <span className="font-mono text-muted-foreground">100%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-emerald-600 dark:bg-emerald-500" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground">Bebas Belanja</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">Aman</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-[65%] rounded-full bg-sky-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quiet AI Assistant Insight Card */}
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Sparkle className="size-3.5 text-primary" weight="fill" />
                <span>Asisten Keuangan</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-muted-foreground">
                Buku kas seimbang. Total uang bebas kamu masih aman untuk memenuhi kebutuhan harian
                selama dua pekan ke depan.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
