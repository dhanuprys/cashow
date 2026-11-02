"use client";

import { formatMoney } from "@cashow/domain";
import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface CategoryExpensePoint {
  name: string;
  total: number;
}

/** Five categorical hues from the theme, then two extra distinguishable hues
 *  for the rare long tail. */
const CATEGORY_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "oklch(0.6 0.14 200)",
  "oklch(0.58 0.16 340)",
];

function money(value: number): string {
  return formatMoney(BigInt(Math.round(value)));
}

export function CategoryChart({ data }: { data: CategoryExpensePoint[] }) {
  const chartData = React.useMemo(() => {
    return data.filter((item) => item.total > 0);
  }, [data]);

  const totalExpense = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.total, 0);
  }, [chartData]);

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      total: {
        label: "Total",
      },
    };
    chartData.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };
    });
    return config;
  }, [chartData]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <figure className="m-0 flex flex-col items-center">
      <figcaption className="sr-only">
        Diagram donat pengeluaran per kategori. Total {money(totalExpense)}.
      </figcaption>
      <ChartContainer
        config={chartConfig}
        className="mx-auto aspect-square max-h-[190px]"
        role="img"
        aria-label={`Pengeluaran per kategori, total ${money(totalExpense)}. Rincian ada pada tabel setelah grafik.`}
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => {
                  const num = Number(value);
                  const percentage =
                    totalExpense > 0 ? ((num / totalExpense) * 100).toFixed(1) : "0";
                  return (
                    <div className="flex w-full items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {money(num)} ({percentage}%)
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="total"
            nameKey="name"
            innerRadius={48}
            outerRadius={72}
            strokeWidth={2}
            stroke="var(--color-card)"
          >
            {chartData.map((item, index) => (
              <Cell key={item.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {chartData.slice(0, 5).map((item, index) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="max-w-24 truncate text-muted-foreground" title={item.name}>
              {item.name}
            </span>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Pengeluaran per kategori</caption>
        <thead>
          <tr>
            <th scope="col">Kategori</th>
            <th scope="col">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((item) => (
            <tr key={item.name}>
              <th scope="row">{item.name}</th>
              <td>{money(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
