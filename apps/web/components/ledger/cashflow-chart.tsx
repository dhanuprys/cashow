"use client";

import { formatMoney } from "@cashow/domain";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface CashflowPoint {
  date: string;
  day: string;
  income: number;
  expense: number;
}

const chartConfig = {
  income: {
    label: "Masuk",
    color: "var(--color-emerald-500, #10b981)",
  },
  expense: {
    label: "Keluar",
    color: "var(--color-rose-500, #f43f5e)",
  },
} satisfies ChartConfig;

/** Axis ticks stay compact; the tooltip and the text alternative use the
 *  same `formatMoney` as the rest of the app so amounts never disagree. */
function formatRupiahShort(value: number): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "")}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}jt`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}rb`;
  }
  return value.toLocaleString("id-ID");
}

function money(value: number): string {
  return formatMoney(BigInt(Math.round(value)));
}

export function CashflowChart({ data }: { data: CashflowPoint[] }) {
  const hasData = React.useMemo(() => {
    return data.some((point) => point.income > 0 || point.expense > 0);
  }, [data]);

  const totals = React.useMemo(() => {
    return data.reduce(
      (acc, point) => ({ income: acc.income + point.income, expense: acc.expense + point.expense }),
      { income: 0, expense: 0 },
    );
  }, [data]);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed text-xs text-muted-foreground">
        Belum ada arus kas harian pada periode ini.
      </div>
    );
  }

  return (
    <figure className="m-0 w-full min-w-0 overflow-hidden">
      <figcaption className="sr-only">
        Grafik batang arus kas harian. Total pemasukan {money(totals.income)} dan total pengeluaran{" "}
        {money(totals.expense)} pada periode ini. Rincian per hari tersedia pada tabel setelah
        grafik.
      </figcaption>
      <ChartContainer
        config={chartConfig}
        className="h-56 w-full min-w-0 sm:h-64"
        role="img"
        aria-label={`Arus kas harian: masuk ${money(totals.income)}, keluar ${money(totals.expense)}.`}
      >
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            tickMargin={8}
            axisLine={false}
            fontSize={11}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={formatRupiahShort}
            width={52}
          />
          <ChartTooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as CashflowPoint | undefined;
                  return point?.date ? `Tanggal ${point.date}` : "";
                }}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">
                      {name === "income" ? "Masuk" : "Keluar"}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {money(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar
            dataKey="expense"
            fill="var(--color-expense)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ChartContainer>

      {/* Same numbers, reachable without seeing colour or position. */}
      <table className="sr-only">
        <caption>Arus kas harian</caption>
        <thead>
          <tr>
            <th scope="col">Tanggal</th>
            <th scope="col">Masuk</th>
            <th scope="col">Keluar</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{money(point.income)}</td>
              <td>{money(point.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
