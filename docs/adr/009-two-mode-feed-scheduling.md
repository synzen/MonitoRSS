# ADR-009 — Two-mode feed scheduling: interval cycles plus clock-time scheduled occurrences

**Status:** Accepted
**Date:** 2026-09-26

## Context

Feeds are fetched on a repeating interval (refresh rate in seconds); every feed's fetch → filter → dedup → delivery cycle runs whenever the interval scheduler decides to fetch the feed's URL. Users cannot control *when* deliveries happen — a user who wants the "top post of a subreddit delivered daily at 21:00 in their timezone" can only make the feed fresher, not punctual. Wall-clock scheduling was specified in `docs/specs/scheduled-feed-delivery.md`; this ADR records the scheduling architecture decisions required to build it.

Constraints that shaped the decision:

- Fetches must stay batched by URL: many feeds sharing one popular URL must cost a single fetch, exactly as interval scheduling does today.
- Users cluster on round times (09:00, 21:00). A naive clock scheduler fires every due feed on the minute's first tick, creating delivery spikes.
- Services deploy with rolling restarts, so for a window both old and new versions run concurrently against the same broker.
- The delivery path must stay at-most-once per occurrence: RabbitMQ redeliveries and emitter restarts cannot be allowed to deliver the same occurrence twice.
- The fetch service (feed-requests) must not gain feed-domain knowledge: it sees URLs, not feeds.

## Decision

Each feed gains a scheduling **mode**. `scheduleMode: "interval" | "scheduled"` on the user feed document, with `schedule: { times: string[], timezone: string }` present if and only if the mode is scheduled. `scheduleMode` is absent on documents written before the feature; **field absence means interval**, so no migration is needed and every interval-side query expresses its exclusion as `scheduleMode: { $ne: "scheduled" }`.

### Trigger metadata, not feed IDs, through the fetch service

The `url.fetch-batch` entry and `url.fetch.completed` contracts gain an optional `trigger: { kind: "interval" | "scheduled", occurredAt: number }` — request metadata in the spirit of the existing `recovery` marker. `occurredAt` is the epoch ms of the scheduled occurrence the fetch fulfills (the wall-clock minute, not the fire time).

- feed-requests copies `trigger` through without interpreting it. It never sees feed IDs; fan-out stays in backend-api.
- **Absent trigger ≡ `kind: "interval"`.** Old producers emit trigger-less events (interval semantics); old consumers strip the unknown field via Zod and fall back to interval semantics. Rolling deploys are therefore safe in both directions.
- One coupling is accepted: the emitter's clock branch and the fan-out's scheduled branch must ship in the same release. A new emitter with an old fan-out would fetch scheduled feeds on schedule but never deliver to them (the old fan-out's rate-scoped matching cannot see scheduled feeds — their retained refresh rate doesn't match the scheduled batch's pseudo rate). Since the feature dark-launches with no UI, no real users can be stranded by that window.

### Clock branch in the schedule emitter

The existing 30-second slot-window loop (`SCHEDULER_WINDOW_SIZE_MS`) gains a clock branch that runs before the interval branches. Due feeds are selected by a pure function of `(feeds, now)` (`scheduled-feed-computation.ts`), which:

1. Computes each feed's most recent scheduled minute at or before `now` as a wall-clock time in the feed's IANA timezone (DST-aware: 21:00 stays 21:00 local year-round).
2. Applies the **catch-up bound**: occurrences missed while the emitter was down still fire if they are within the previous 15 minutes (`SCHEDULED_CATCHUP_WINDOW_MS`, measured against the occurrence's effective fire time below); anything older is skipped until the next occurrence. The window derives purely from tick time — no per-feed "last fired" read is needed to compute it.
3. Skips occurrences already recorded as fired (`lastScheduledFiredAt` read alongside the feed) so recovered or repeated ticks do not re-fire.
4. Applies **hot-minute spreading**: each URL fires at a delay slot derived from its stable FNV-1a hash, inside a 10-minute window after the wall-clock minute (`SCHEDULED_JITTER_WINDOW_MS`; at 30-second ticks, 20 slots). Users cluster on round times (09:00, 21:00), so a host serving many scheduled subscriber URLs would otherwise receive every one of them inside the same wall-clock minute — the one dimension interval scheduling spreads across a whole cycle but clock scheduling cannot. The slot is keyed by **URL** — the fetch batching unit — so feeds sharing a URL always fire together and cost a single fetch, mirroring how interval spreading assigns slot offsets by URL hash. The user-facing promise is "around" the scheduled time (≤10 minutes late).

Due feeds are then grouped by URL into the same batch shape as interval fetches (lookup-key feeds resolve per-feed credentials exactly as the interval path does), sub-batched at 25 entries, and published with `rateSeconds` stamped to `SCHEDULED_BATCH_RATE_SECONDS` (3600) and each entry stamped `trigger: { kind: "scheduled", occurredAt }`.

The 3600 pseudo rate is deliberately not a real tier value: it derives the batch's queue TTL (`rateSeconds × 1000` = 1 hour, matching the fan-out staleness cap below). The request worker scopes scheduled entries to a short response-reuse window (`SCHEDULED_DEDUPE_WINDOW_SECONDS` = 2 minutes) — long enough to collapse duplicate same-URL entries processed together, short enough that a feed's next scheduled occurrence always fetches fresh instead of serving a minutes-old response.

### Fan-out by trigger kind

The completed-event handler in backend-api branches on the trigger:

- **Absent / interval:** today's rate-scoped fan-out, now additionally excluding scheduled feeds (via the shared aggregate query) so a scheduled feed can never piggyback on another feed's interval fetch of the same URL. Conversely, scheduled triggers never feed the interval path: a scheduled fetch only serves scheduled feeds, and interval feeds keep their own cycles.
- **Scheduled:**
  1. **Staleness cap** — triggers older than 1 hour (`SCHEDULED_TRIGGER_STALENESS_MS`, measured against fan-out wall clock) are rejected, so an ancient queued event cannot deliver off-schedule. The check uses fan-out time because its purpose is bounding queue latency, not schedule matching.
  2. **Occurrence matching** — the feed must be due for *this* occurrence: `occurredAt` resolves to the feed's own scheduled wall-clock minute in its timezone. This is checked against the trigger's `occurredAt`, not fan-out wall clock, so a fetch completing late within the bounds still delivers ("deliver late within the bound" promise), and feeds sharing a URL but running different schedules are separated.
  3. **Once-per-occurrence guard** — a conditional update records `lastScheduledFiredAt = occurredAt` on the feed document only if no equal-or-later occurrence is already recorded; the winner emits the delivery events. Queue redeliveries and emitter restarts become no-ops. Placing the guard at fan-out (not at emit time) keeps fetch failure non-blocking: a failed fetch leaves the occurrence unclaimed, so a later tick's re-fetch within the catch-up window can still deliver. Article idHash dedup remains the final backstop against duplicate messages.

### What stays interval-only

Recovery fetches short-circuit before fan-out as today; tier refresh-rate sync ignores schedule fields (scheduled mode is available on all tiers — it is always slower than every tier's fastest rate, so there is nothing to gate); manual/debug refreshes take the interval trigger default and cannot pull a scheduled feed off its schedule; the delivery payload is untouched.

## Consequences

**Easier:**

- Future cadence features (weekly schedules, digests) extend the schedule shape and the clock branch without touching the interval machinery.
- Adding a new trigger kind is a contract change plus one branch at fan-out; the fetch service stays ignorant of all of them.

**Harder / accepted costs:**

- The once-per-occurrence guard lives at fan-out, so until a completed event's claim lands, the emitter re-selects the same occurrence on every tick from its URL's fire time onward within the catch-up window. Response reuse (the 2-minute window) plus conditional GETs (If-None-Match / If-Modified-Since) keep those re-fires cheap, and the guard keeps delivery at-most-once — the cost is no-op batch entries and cheap re-fetches, bounded by the catch-up window. Failing URLs are additionally protected by feed-requests' existing failure backoff.
- Spreading divides a hot minute's burst by the number of jitter slots (~20) but does not bound requests per host per minute; a host with enough scheduled subscriber URLs can still see a large (if slower-drip) burst. A generic per-host rate limit in feed-requests is the follow-up hard cap; the allowlist-based `HostRateLimiterService` covers only two hosts today.
- If the emitter process restarts, phase drift can leave a URL's slot tick missed; because an occurrence is due on the first tick at or after its effective fire time (slot-arrival, not slot-exact matching), it fires on the next tick instead of waiting a full day — still inside the "around the scheduled time" promise and the catch-up bound.
- The clock branch materializes the scheduled-feed list each tick to run the pure selection. Scheduled feeds are a bounded, slow-cadence population; if that ever stops being true, the selection can move into an aggregation with per-timezone date expressions — the pure-function seam keeps that a drop-in change.
- The pseudo `rateSeconds` on scheduled batches is invisible magic at the contract level; it must never collide with a real tier rate's semantics. The occurrence-scoped processing lock in feed-requests (lock keys carry `occurredAt` for scheduled entries) prevents same-URL entries with different occurrences from dropping each other's completed events.
- `@monitorss/contracts` must be published (0.3.0) before Docker builds pick up the trigger field; local workspace development resolves it by symlink.

## See also

- ADR-002 — RabbitMQ event spine; ADR-006 — internal package versioning; ADR-007 — contracts package.
- `docs/specs/scheduled-feed-delivery.md` — the feature spec this ADR implements.
