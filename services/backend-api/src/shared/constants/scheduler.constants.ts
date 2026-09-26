export const SCHEDULER_WINDOW_SIZE_MS = 30_000;

// How far past its wall-clock time a scheduled occurrence still fires when the
// emitter recovers (ADR-009). Occurrences older than this are skipped until the
// next one.
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
