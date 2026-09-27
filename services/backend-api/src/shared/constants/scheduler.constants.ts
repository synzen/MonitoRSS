export const SCHEDULER_WINDOW_SIZE_MS = 30_000;

// Deterministic per-URL firing delay: a scheduled URL fires within this window
// after its wall-clock time, at a slot derived from the URL's hash. Users
// cluster on round times, so a host serving many scheduled subscriber URLs
// would otherwise receive every one of them inside the same wall-clock minute
// (the interval path spreads across the whole cycle; there is no such room
// here). The slot is keyed by URL — the fetch batching unit — so feeds sharing
// a URL always fire together and cost a single fetch (ADR-009).
export const SCHEDULED_JITTER_WINDOW_MS = 10 * 60 * 1000;

// Number of 30-second slots the jitter window divides into; each scheduled URL
// fires at the one its hash picks.
export const SCHEDULED_JITTER_SLOTS =
  SCHEDULED_JITTER_WINDOW_MS / SCHEDULER_WINDOW_SIZE_MS;

// How far past its effective fire time (occurrence + jitter slot) a scheduled
// occurrence still fires when the emitter recovers (ADR-009). Occurrences
// older than this are skipped until the next one.
export const SCHEDULED_CATCHUP_WINDOW_MS = 15 * 60 * 1000;

// Completed-event fan-out staleness cap: a scheduled trigger whose occurrence
// is older than this at fan-out time never delivers (ADR-009). Keeps ancient
// queued events from delivering off-schedule.
export const SCHEDULED_TRIGGER_STALENESS_MS = 60 * 60 * 1000;

// Pseudo refresh rate stamped on scheduled fetch batches. It never matches a
// real tier rate: it derives the batch queue TTL (rateSeconds * 1000 = 1h,
// matching the staleness cap). The request worker scopes its response-reuse
// window for scheduled entries separately (2 min) so a feed's next scheduled
// occurrence always fetches fresh.
export const SCHEDULED_BATCH_RATE_SECONDS = 3600;
