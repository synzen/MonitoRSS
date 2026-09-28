import {
  SCHEDULED_JITTER_SLOTS,
} from "../../src/shared/constants/scheduler.constants";
import { fnv1aHash } from "../../src/shared/utils/fnv1a-hash";

// The firing delay slot is keyed by URL, so tests pick URLs with a known slot.
export function urlWithSlot(slot: number, base: string): string {
  for (let i = 0; i < 1000; ++i) {
    const url = `https://example.com/${base}-${i}.xml`;

    if (fnv1aHash(url) % SCHEDULED_JITTER_SLOTS === slot) {
      return url;
    }
  }

  throw new Error(`No url found for slot ${slot}`);
}
