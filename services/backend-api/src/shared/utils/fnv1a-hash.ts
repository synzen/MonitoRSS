const FNV1A_64_OFFSET_BASIS = BigInt("14695981039346656037");
const FNV1A_64_PRIME = BigInt("1099511628211");
const MASK_64 = BigInt("0xFFFFFFFFFFFFFFFF");
const MASK_32 = BigInt(0xffffffff);

/**
 * FNV-1a (Fowler-Noll-Vo) 64-bit hash function.
 *
 * A fast, non-cryptographic hash that produces well-distributed values.
 * Used for deterministic slot assignment in feed scheduling.
 *
 * Uses 64-bit arithmetic for better distribution, then returns the lower
 * 32 bits for use in modulo operations.
 *
 * @see https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
export function fnv1aHash(str: string): number {
  let hash = FNV1A_64_OFFSET_BASIS;

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * FNV1A_64_PRIME) & MASK_64;
  }

  return Number(hash & MASK_32);
}

/**
 * Calculate the slot offset for a feed URL within its refresh interval.
 *
 * This enables staggered feed fetching: instead of fetching all feeds with
 * the same refresh rate at once, each feed is assigned a deterministic
 * position (slot) within the interval based on its URL hash.
 *
 * Example for a 20-minute (1,200,000ms) interval:
 * - Feed A (slotOffsetMs = 150,000) fetches at ~2:30 into each cycle
 * - Feed B (slotOffsetMs = 900,000) fetches at ~15:00 into each cycle
 *
 * The scheduler runs every 60 seconds and queries feeds whose slotOffsetMs
 * falls within the current 60-second window, spreading load evenly.
 *
 * @param url - The feed URL to hash
 * @param refreshRateSeconds - The refresh interval in seconds
 * @returns Slot offset in milliseconds (0 to refreshRateMs - 1)
 */
export function calculateSlotOffsetMs(
  url: string,
  refreshRateSeconds: number,
): number {
  const refreshRateMs = refreshRateSeconds * 1000;

  return fnv1aHash(url) % refreshRateMs;
}
