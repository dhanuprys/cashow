import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-12">
      <span className="grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Halaman tidak ditemukan
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Tautan ini mungkin sudah dipindahkan, atau datanya sudah dihapus. Mulai lagi dari ringkasan.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href="/app" />}>
          Ke ringkasan
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/app/transactions" />}>
          Lihat transaksi
        </Button>
      </div>
    </main>
  );
}
