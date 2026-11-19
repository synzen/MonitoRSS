import logger from '../utils/logger';
import {
  type PlatformFeedIdentity,
  type PlatformHttpGet,
  type PlatformProviderRegistry,
  type PlatformProviderStateStore,
  type PlatformUrlMatcher,
} from './types';
import { resolveDefaultPlatformAdapter } from './router';

// The provider APIs behind the adapters are rate-limited and that budget is
// shared with user-facing traffic (feed creation, fetches), so releases drain
// far below the limit to keep headroom for them. The interval is also
// the global release rate across every feed-requests process: each release
// claims a shared Postgres slot (RELEASE_SLOT_STATE_KEY), so N pods behind the
// load balancer still release at most one identity per interval combined.
const RELEASE_INTERVAL_MS = 5000;

// State-store keys this service owns. The adapters' identityFromStateKey
// parses neither prefix, so sweeps ignore them.
const ACTIVE_IDENTITY_KEYS_STATE_KEY = 'gc:active-identity-keys';
const RELEASE_SLOT_STATE_KEY = 'gc:release-slot';

const identityKey = (identity: PlatformFeedIdentity) =>
  `${identity.platform}:${identity.kind}:${identity.value}`;

/**
 * Garbage collection for platform-provider remote resources. The consumer
 * (backend-api's schedule-emitter maintenance loop) periodically posts the
 * URLs of feeds that actually fetch; every stored state key whose identity is
 * absent from that set gets released through its adapter's optional
 * releaseFeedDocument (deletes the remote resource and forgets the key).
 * Non-platform URLs resolve to nothing and are simply ignored.
 */
export interface PlatformProviderSyncService {
  /**
   * Syncs the referenced URL set and queues releases for unreferenced
   * identities. Returns immediately with the queue size; the actual releases
   * drain in the background, one per interval across all processes.
   */
  syncActiveUrls(urls: string[]): Promise<{ queued: number }>;
}

export function createPlatformProviderSyncService({
  matchPlatform,
  platformProviderRegistry,
  stateStore,
  httpGet,
  releaseIntervalMs = RELEASE_INTERVAL_MS,
  releaseSlotTtlMs = releaseIntervalMs,
}: {
  matchPlatform: PlatformUrlMatcher;
  platformProviderRegistry: PlatformProviderRegistry | undefined;
  stateStore: PlatformProviderStateStore;
  httpGet: PlatformHttpGet;
  releaseIntervalMs?: number;
  releaseSlotTtlMs?: number;
}): PlatformProviderSyncService {
  // Release queue for this process. A restart loses it — harmless, the next
  // sweep re-discovers every still-stored key and re-enqueues it.
  const pendingKeys = new Map<string, PlatformFeedIdentity>();
  let drainTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDrain = () => {
    if (drainTimer) {
      return;
    }

    drainTimer = setTimeout(async () => {
      drainTimer = null;

      const entry = pendingKeys.entries().next();
      const [key, identity] = entry.value ?? [undefined, undefined];

      if (key && identity) {
        pendingKeys.delete(key);

        try {
          const adapter = resolveDefaultPlatformAdapter(
            platformProviderRegistry,
            identity.platform,
            { httpGet, stateStore },
          );

          // A stateless provider advertises no release; nothing to do and
          // the key stays (only adapters owning the key may delete it).
          if (adapter.releaseFeedDocument) {
            // Re-validate against the latest sweep before deleting: a queued
            // entry may be stale — a user may have re-created the identity
            // after the sweep snapshot, and the release must not delete the
            // fresh vendor feed behind the re-created key. Skipped entries
            // are dropped; the next sweep re-enqueues them if the reference
            // disappears again.
            if (await isIdentityUnreferenced(identity)) {
              // A failed claim means another process owns the global slot
              // this tick: re-queue for the next tick.
              if (await tryClaimReleaseSlot()) {
                // A failed release is dropped: the next sweep re-lists the
                // key and re-enqueues it. A vendor 429 from racing user
                // traffic costs nothing — the user request that won the slot
                // succeeds.
                await adapter.releaseFeedDocument(identity);
              } else {
                pendingKeys.set(key, identity);
              }
            }
          }
        } catch (err) {
          logger.warn('Failed to release platform provider identity', {
            key,
            error: (err as Error).stack,
          });
        }
      }

      if (pendingKeys.size > 0) {
        scheduleDrain();
      }
    }, releaseIntervalMs);

    drainTimer.unref();
  };

  // Whether the most recent sweep still reports the identity as unreferenced.
  // Unparsable data (should not happen) skips the release: only a fresh sweep
  // re-enables it.
  const isIdentityUnreferenced = async (
    identity: PlatformFeedIdentity,
  ): Promise<boolean> => {
    const raw = await stateStore.get(ACTIVE_IDENTITY_KEYS_STATE_KEY);

    if (!raw) {
      return true;
    }

    try {
      return !(JSON.parse(raw) as string[]).includes(identityKey(identity));
    } catch {
      return false;
    }
  };

  // Cross-process lease: at most one release per interval across every
  // feed-requests process. Clock skew between pods shifts the pacing slightly,
  // never below the vendor's own rate limiting.
  const tryClaimReleaseSlot = async (): Promise<boolean> => {
    const deadline = String(Date.now() + releaseSlotTtlMs);
    const existing = await stateStore.get(RELEASE_SLOT_STATE_KEY);

    if (existing === null) {
      return stateStore.setIfAbsent(RELEASE_SLOT_STATE_KEY, deadline);
    }

    if (Number(existing) > Date.now()) {
      return false;
    }

    return stateStore.setIfValueIs(RELEASE_SLOT_STATE_KEY, existing, deadline);
  };

  return {
    async syncActiveUrls(urls) {
      if (!platformProviderRegistry) {
        // OSS build without the private package: nothing is tracked, so
        // nothing can be released.
        return { queued: 0 };
      }

      const referenced = new Set<string>();

      for (const url of urls) {
        const identity = matchPlatform(url);

        if (identity) {
          referenced.add(identityKey(identity));
        }
      }

      // The latest referenced set, used at release time to re-validate queued
      // entries (see isIdentityUnreferenced).
      await stateStore.set(
        ACTIVE_IDENTITY_KEYS_STATE_KEY,
        JSON.stringify([...referenced]),
      );

      const keys = await stateStore.listKeys();
      let queued = 0;

      for (const key of keys) {
        const identity =
          platformProviderRegistry.identityFromStateKey?.(key) ?? null;

        if (!identity || referenced.has(identityKey(identity))) {
          continue;
        }

        // Dedupe successive sweeps while a backlog is still draining.
        if (pendingKeys.has(key)) {
          continue;
        }

        pendingKeys.set(key, identity);
        queued++;
      }

      if (queued > 0) {
        scheduleDrain();
      }

      return { queued };
    },
  };
}
