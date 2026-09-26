# Benchmarks

Every number on the résumé comes from this file. Record a row per round with the commit, the
dataset, and where the number came from. Numbers come from `/admin` (p50/p95 over the
`metrics` table), Playwright logs, or k6 output.

## How to measure

| Metric | Source | How |
|---|---|---|
| **M1** perceived action latency | `metrics` name `action_latency` (tag = move/update/create) | Use the app normally for a few minutes, read p50/p95 on `/admin` |
| **M2** cross-client sync latency | `metrics` name `sync_latency`; Playwright `collaboration.spec.ts` logs `[M2 baseline]` | Two browsers (e.g. two dev logins) on one board; change things in one |
| **M3** API latency under load | k6 (Round 2) | `pnpm db:seed --issues=10000`, then k6 against board/move endpoints |
| **M4** search latency | `metrics` name `search_latency` (tag = `title_ilike` in v1) | Seed 1k / 10k / 100k issues, search from the palette |
| **M5** webhook correctness + speed | `metrics` name `webhook_close_latency`; `pnpm webhook:test --repeat=5` | Replay the same delivery, count duplicate side effects |
| board load | `metrics` name `board_load` | Hard-refresh the board |

Clear old samples between runs: `docker exec stride-db psql -U stride -d stride -c "truncate metrics"`.

## v1 baseline — design notes (what the rounds will improve)

- Writes wait for the server (no optimistic UI) → **M1** baseline.
- Sync = full-board poll every 10 s → **M2** baseline (expect ≈ 0–10 s, avg ≈ 5 s).
- Only primary keys / uniqueness constraints are indexed; board = 4 queries → **M3** baseline.
- Search = `ILIKE '%q%'` on titles (sequential scan) → **M4** baseline.
- Webhooks processed inside the request, no delivery-id de-duplication, no queue/retries → **M5** baseline.

## Results

| Date | Round | Commit | Dataset | Metric | p50 | p95 | Notes |
|---|---|---|---|---|---|---|---|
| | v1 | | 40 issues | M1 action_latency (move) | | | local, Docker Postgres |
| | v1 | | 40 issues | M2 sync_latency | | | 2 browsers, same machine |
| | v1 | | 10k issues | M4 search_latency | | | |
