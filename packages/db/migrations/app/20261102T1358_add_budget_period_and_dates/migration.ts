#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/affc841717f5b357f53875d5b0e20c0b4f75f7cb26f0d867d2ac32174b007872/contract';
import startContract from '../../snapshots/affc841717f5b357f53875d5b0e20c0b4f75f7cb26f0d867d2ac32174b007872/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b8a9108761238d484af357efab4532f80476f4171d132fe3271a6ce265bc01e9/contract';
import endContract from '../../snapshots/b8a9108761238d484af357efab4532f80476f4171d132fe3271a6ce265bc01e9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Budget',
        column: col('endDate', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Budget',
        column: col('period', 'text', {
          notNull: true,
          default: lit('MONTHLY'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Budget',
        column: col('startDate', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Budget',
        constraint: 'Budget_period_check_a8c1719c',
        expression: sql`"period" IN ('MONTHLY', 'WEEKLY', 'CUSTOM')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Budget',
        constraint: 'budget_date_range_valid_85c225a0',
        expression: sql`"startDate" IS NULL OR "endDate" IS NULL OR "startDate" <= "endDate"`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
