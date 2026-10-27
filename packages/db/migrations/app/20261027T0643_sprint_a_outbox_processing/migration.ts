#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/34c824378cb5210717c798e1dd5efc6f4bfcf2e9e0dc3dda41ca44f79cb5d326/contract';
import endContract from '../../snapshots/34c824378cb5210717c798e1dd5efc6f4bfcf2e9e0dc3dda41ca44f79cb5d326/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d8372036127f16ba1397e8a5a6245caa6e95634f6c1c7c9e8d3cd4fa09d2a2e2/contract';
import startContract from '../../snapshots/d8372036127f16ba1397e8a5a6245caa6e95634f6c1c7c9e8d3cd4fa09d2a2e2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'OutboxEvent',
        constraint: 'OutboxEvent_status_check_900a3b11',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'OutboxEvent',
        constraint: 'OutboxEvent_status_check_8a5bce80',
        expression: sql`"status" IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
