# 0004 — Biome for lint and format

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Next.js 16 removed `next lint`, so linting is a separate tool. ESLint plus
Prettier needs a large plugin surface and two configs for the same files. The
repository is TypeScript-only, with Tailwind v4 CSS.

## Decision

Use Biome 2 for both linting and formatting:

- 2-space indentation, 100-column lines, double quotes.
- `organizeImports` on save.
- `css.parser.tailwindDirectives` enabled for Tailwind v4 `@theme`/`@apply`.
- Ignore vendored/generated paths: `.agents`, `.claude`, `.cursor`, `.devin`,
  `.next`, `public`, the Prisma migration packages, and the emitted
  `contract.json`/`contract.d.ts`.

`bun run lint` fails on diagnostics; `bun run format` rewrites.

## Consequences

- One binary, one config, fast enough to run on every save and in CI.
- Rules that need type information are not available. If a type-aware rule
  becomes necessary, add ESLint for that rule rather than replacing Biome.
- Generated Prisma artifacts are excluded because they are not hand-authored;
  regenerating them must not churn formatting.
