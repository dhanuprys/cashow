export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-md">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Cashow
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {children}
        </div>
      </section>
    </main>
  );
}
