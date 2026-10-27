const principles = [
  {
    title: "Uang masuk",
    body: "Setiap sumber dana punya sisa yang jelas: sudah dialokasikan berapa, masih bebas berapa.",
  },
  {
    title: "Alokasi",
    body: "Pengeluaran menarik dana dari pemasukan tertentu, bukan sekadar menambah angka pengeluaran.",
  },
  {
    title: "Laporan",
    body: "Saldo dihitung ulang dari transaksi, bukan disimpan sebagai angka yang bisa basi.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Cashow
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ikuti ke mana uangmu mengalir.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
          Pencatat keuangan pribadi yang bisa kamu host sendiri. Uang masuk, pengeluaran, dan
          alokasi di antaranya tercatat rapi — tanpa angka yang hilang.
        </p>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          {principles.map((principle) => (
            <div key={principle.title} className="rounded-xl border border-border bg-card p-4">
              <dt className="font-medium text-card-foreground">{principle.title}</dt>
              <dd className="mt-2 text-sm leading-6 text-muted-foreground">{principle.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-sm text-muted-foreground">
          Fase 0 selesai: fondasi monorepo, skema basis data, dan stack deployment sudah berjalan.
        </p>
      </section>
    </main>
  );
}
