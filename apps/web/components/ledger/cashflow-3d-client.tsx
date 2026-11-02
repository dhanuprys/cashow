"use client";

import dynamic from "next/dynamic";

export function Cashflow3DFallback() {
  return (
    <div className="relative flex h-[480px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
      <div className="relative flex size-44 items-center justify-center rounded-full border border-dashed border-primary/30 bg-primary/5">
        <div className="size-28 animate-pulse rounded-full border border-border bg-muted/40" />
        <div className="absolute size-3.5 rounded-full bg-primary/40" />
      </div>
      <p className="mt-4 font-heading text-sm font-medium text-foreground">
        Memuat kanvas interaktif tiga dimensi…
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        Inisialisasi simulasi buku kas terdesentralisasi
      </p>
    </div>
  );
}

const Cashflow3D = dynamic(
  () => import("@/components/ledger/cashflow-3d").then((mod) => mod.Cashflow3D),
  {
    ssr: false,
    loading: () => <Cashflow3DFallback />,
  },
);

export function Cashflow3DSection() {
  return <Cashflow3D />;
}
