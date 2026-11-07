# ADR-011 — Feed retry backoff: one time-based per-URL schedule owned by feed-requests

**Status:** Accepted
**Date:** 2026-11-07

## Context

A feed's detection latency is bounded by how often its URL is successfully fetched. Production evidence (feed `6ab572b6fa09823a07b93f22`, a YouTube channel feed on a 20-minute refresh rate) shows the current failure handling turns that bound into hours:

- YouTube intermittently returns 404/500 to this URL in windows ranging from minutes to ~26 hours, nearly every day.
- On each failure, `calculateNextRetryDate` (`services/feed-requests/src/feed-fetcher/scheduled-fetch.ts:48`) schedules the next attempt at `BASE_FAILED_ATTEMPT_WAIT_MINUTES × 2^attempts` (5, 10, 20 … 320 minutes, uncapped). The Nov 4–5 outage produced a 21h20m gap between attempts; a video published 01:57 UTC was detected 11:58 — a ~10h delay fully explained by the backoff, not by the outage.
- `failedAttempts` counts all failures since the last OK — including the user's own manual retries (each manual failure doubled the wait further).
- At 11 failures (`FEED_REQUESTS_MAX_FAIL_ATTEMPTS`, default), feed-requests emits `url.failed.disable-feeds`; backend-api disables the feed terminally (`FAILED_REQUESTS` + health `Failed`). Time-to-disable is therefore a synthesis of count × backoff shape (~85h of continuous failure), and revival requires a user-initiated bulk retry that moves feeds into a "recovery limbo" state (`FAILED_REQUESTS` + `Failing` + `recoveryStartedAt`), which resets the failure counter via an epoch threaded through fetch messages.

Two structural problems follow. First, retry policy is split: feed-requests owns pacing, backend-api owns a second, coarser give-up/retry-again loop (disable → limbo → re-enable) that re-implements backoff at the product layer — a recovery cycle is literally "reset the inner loop once." "How long do we try?" is only answerable by composing constants from both services. Second, the semantics are wrong for flaky-but-alive sources: transient outages produce silent multi-hour delivery gaps with a healthy-looking badge, while the disable path produces feeds that stay dead until a user clicks. 17,393 feeds currently sit in the terminal state.

The scheduler itself needs no change: backend-api ticks every feed on its refresh rate (ADR-009), and feed-requests already decides per tick whether to fetch (`shouldSkipAfterPreviousFailedAttempt`). feed-requests is the de-facto owner of retry pacing; the outer loop exists only because the inner one hits an arbitrary count wall.

## Decision

Replace the failure-count threshold and exponential backoff with **one time-based, per-URL retry backoff, derived from existing data, owned by feed-requests**. backend-api becomes a mapper of backoff transitions onto feed state; user-facing status vocabulary and event contracts are reused unchanged.

### 1. The backoff

Let `elapsed` = now − the latest OK request for `lookupKey || url` (or the earliest request if none exists). The interval before the next fetch attempt for that URL is:

| elapsed since last success | interval |
|---|---|
| < `max(4h, 2 × rateSeconds)` | `rateSeconds` — the active phase: failures never wait longer than the feed's own cadence |
| < 24h | `max(1h, rateSeconds)` |
| < 72h | `max(6h, rateSeconds)` |
| < 14 days | `max(24h, rateSeconds)` |
| ≥ 14 days | **expired**: stop probing; emit `url.failed.disable-feeds` |

Any successful fetch — scheduled, manual, delivery-preview, any source — resets `elapsed` to zero. Probe intervals are never shorter than the feed's own refresh rate.

### 2. State is derived, not stored

The backoff state is computed per tick from `request_partitioned` rows (latest OK timestamp, latest attempt's `response_headers`). No new state store, no new tables, restart-safe. `next_retry_date` stays populated as `lastAttempt + currentInterval` for observability (the delivery preview's next-retry text keeps working) but no longer drives the skip decision.

### 3. Rate-limit responses get a floor

When the latest attempt returned 429 (or 503), the next interval is floored at `max(interval, Retry-After header, 1h)`, clamped at 24h so a hostile header cannot silence a URL. The 1h floor only binds in the active phase; once tiers engage they dominate, and `Retry-After` matters only when longer than the current tier. 429s run the availability clock like any failure — a host that rate-limits us for 14 continuous days expires like any dead source. Host-level cooldown is explicitly out of scope (see Non-goals).

### 4. Suspension is invisible to users

Crossing the suspension threshold changes nothing user-facing: no disable, no alert, no status code. The feed keeps its health badge (`url.failing` on each failure → badge `Failing`, as today), deliveries stop naturally because the source yields nothing, and limit-slot behavior is unchanged (failure-disabled feeds already hold slots today). The "Pending Retry" limbo disappears from the product.

### 5. Expiry reuses the existing event and status

`url.failed.disable-feeds` keeps its name, payload shape (`{url, lookupKey?}`), queue, and consumer behavior (`disableFeedsAndSetHealthStatus(FAILED_REQUESTS, Failed)` + one alert via `findIdsWithoutDisabledCode` transition dedup — repeat emissions post-expiry are no-ops downstream). Only its trigger inside feed-requests changes: 14 days of continuous failure instead of 11 counted failures. The `recovery` epoch marker on fetch messages stops being populated (field retained in contracts for skew safety; ADR-007 consumer-side Zod validation makes both skew directions safe: old feed-requests + new backend-api = today's behavior; new feed-requests + old backend-api = expiry simply fires later).

The one contract addition is an optional `force` flag on `url.fetch-batch` items: bulk retry's fetch-now must bypass the backoff skip, the fresh-cache skip, and the dedupe window, which the retained `recovery` marker cannot express. It is additive and skew-safe (old consumers strip unknown fields).

### 6. backend-api shrinks to a state mapper

- `handleUrlRequestFailureEvent` is unchanged code, now meaning "expired" instead of "threshold hit".
- The recovery branch (`revertRecoveryFeedsToFailed`) is deleted.
- `handleUrlFetchCompletedEvent` re-enables: on a successful fetch, clear `FAILED_REQUESTS` from feeds on that URL regardless of health status (retargeting `clearDisabledCodeForRecoveredFeeds`, dropping the health + epoch conditions) — this is what revives expired feeds when a retry-triggered fetch succeeds.
- `startBulkRetry` becomes "emit a fetch-now message per unique URL behind the workspace's `FAILED_REQUESTS` feeds" (any health); the `recoveryAlreadyActive` guard is deleted (per-URL response dedup absorbs spam).
- Individual manual retry is unchanged: retryable-code list already covers `FAILED_REQUESTS`, success re-enables inline, and a manual success resets the backoff like any success. Manual failures neither advance nor reset the backoff (time-based).
- The schedule filter is unchanged: expired feeds (`FAILED_REQUESTS` + `Failed`) stay excluded from ticks, as terminal feeds are today. Suspended feeds were never disabled, so they are ticked like every enabled feed and the backoff skips them per interval.

### 7. No data migration

Existing `FAILED_REQUESTS`-disabled feeds (17,393 terminal, plus badge debris: 4,385 `Failed`-disabled with `OK` badge, 1,103 with `Failing` badge) are left as-is and interpreted as expired. Users revive them with the existing retry buttons. Badge noise is accepted: the badge is advisory; `disabledCode` is the switch.

### 8. Config

`FEED_REQUESTS_MAX_FAIL_ATTEMPTS` is removed. Backoff constants become `FEED_REQUESTS_*` env vars with the defaults above: suspension base (4h) and rate multiplier (2), tier boundaries (24h, 72h), expiry (14d), rate-limit floor (1h), Retry-After clamp (24h).

## Consequences

**Easier:**

- Detection latency ≈ outage length + one interval, instead of outage length + backoff debt. The 10-hour class of delay reported on YouTube feeds disappears.
- One retry policy with one owner. "How long do we keep trying?" is a single number (14 days), not count × backoff shape × epoch semantics.
- Transient outages self-heal with no user action; nothing enters a dead-until-click state for being flaky.
- Near-zero contract churn: the only payload change is the optional `force` flag on `url.fetch-batch` items (§5); no new events, queues, or status codes. Skew-safe in both deploy directions.
- No new state store to persist, rebuild, or clean up.

**Harder / risks:**

- During an outage's active phase, a failing URL is fetched at its full rate (previously the backoff decayed to near-silence). Per-URL dedup collapses shared URLs, and the backoff decays load after `max(4h, 2×rate)`, but a mass outage (e.g., egress IP blocked) now relies entirely on the backoff for load shedding — the fleet-level governor and host-level 429 cooldown that would cover this are named non-goals below.
- `url.failed.disable-feeds` is emitted on every tick past expiry; downstream dedup makes this correct but not free (one no-match update per tick per expired URL).
- Users get no alert between first failure and day 14 — badge and feed-page next-check text only. Deliberate (one alert per outage lifetime at disable).
- The 17,393 already-terminal feeds stay dead until their users act.
- Backoff constants are fleet-wide; per-feed variation enters only through `rateSeconds`.

## Non-goals

- **Global error-ratio governor** — out of scope entirely. (A fetcher-level rule to stretch all waits when the fleet-wide error ratio spikes would cover mass-outage storms; it needs its own design round.)
- **Host-level 429 cooldown** — backing off all URLs on a host when it rate-limits the shared egress identity; `host_hash` already exists in `request_partitioned` to build on.
- **`INVALID_FEED` parse-failure auto-recovery** — a different detection surface; future extension.
- **Archival/cleanup policy** for feeds expired long-term.

## See also

- ADR-009 — two-mode scheduling; the backoff composes with both interval and clock-scheduled modes and inherits their tick/dedup machinery.
- ADR-007 — `packages/contracts` ownership and consumer-side validation, which makes the zero-churn skew story hold.
- ADR-010 — feed-requests standard stack; the skip logic replaced here lives in the module it migrated.
