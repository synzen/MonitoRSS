import { RequestStatus } from '../feed-fetcher/types';

export type PlatformFeedIdentity = {
  platform: 'reddit' | 'twitter' | 'instagram';
  kind:
    | 'subreddit'
    | 'user'
    | 'comment-thread'
    | 'user-multi'
    | 'search'
    | 'domain';
  value: string;
  sort?:
    | 'new'
    | 'hot'
    | 'top'
    | 'rising'
    | 'controversial'
    | 'best';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  search?: {
    query: string;
    sort?: 'relevance' | 'new' | 'hot' | 'top' | 'comments';
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    nsfw?: boolean;
  };
  globalSearch?: {
    query: string;
    sort?: 'relevance' | 'new' | 'hot' | 'top' | 'comments';
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    nsfw?: boolean;
  };
  domain?: {
    domain: string;
    sort?: 'new' | 'hot' | 'top' | 'rising' | 'controversial' | 'best';
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  };
  commentThread?: { subreddit: string; postId: string };
  userMulti?: {
    user: string;
    multi: string;
    sort?: 'new' | 'hot' | 'top' | 'rising' | 'controversial' | 'best';
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  };
};

/**
 * The platform-providers adapter contract. An adapter translates its provider's
 * arbitrary response shape into an RSS document that carries the canonical
 * platform-native post ID in <guid> and the canonical permalink in <link>;
 * downstream parsing and dedup key on those unchanged.
 */
/**
 * Per-request fetch context supplied by the consumer. Adapters that fetch on
 * behalf of an end user (e.g. reddit through a user's OAuth grant) receive
 * their credential here; providers with deployment-level credentials ignore
 * it.
 */
export interface PlatformProviderFetchOptions {
  bearerToken?: string;
}

/**
 * A normalized feed document plus the reuse window its provider response
 * advertised.
 */
export interface PlatformFeedDocument {
  document: string;
  /**
   * Freshness of the provider response this document was rendered from, in
   * seconds. `undefined` means the response carried no cache information (the
   * configured fallback applies); `0` means it must not be reused
   * (no-store / no-cache / max-age=0).
   */
  freshnessSeconds?: number;
}

export interface PlatformProviderAdapter {
  fetchFeedDocument(
    identity: PlatformFeedIdentity,
    options?: PlatformProviderFetchOptions,
  ): Promise<PlatformFeedDocument>;
  /**
   * Releases the remote resource for the identity once no consumer feed
   * references it (garbage collection). Optional: stateless providers have
   * nothing to release. Idempotent — releasing an already-released identity
   * is a no-op.
   */
  releaseFeedDocument?(identity: PlatformFeedIdentity): Promise<void>;
}

export interface PlatformHttpResponse {
  ok: boolean;
  status: number;
  headers: Map<string, string>;
  text: () => Promise<string>;
}

export interface PlatformHttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Shared HTTP surface adapters use to reach their provider endpoints; backed
 * by fetchFeedResponse (timeout, redirects, gzip, charset handling).
 */
export type PlatformHttpGet = (
  url: string,
  options?: PlatformHttpOptions,
) => Promise<PlatformHttpResponse>;

/**
 * Errors thrown by the platform-providers layer. Carries the RequestStatus it
 * maps into, so fetch failures surface through the existing failure taxonomy
 * (backoff, disable events, health status) unchanged.
 */
export class PlatformProviderFetchError extends Error {
  requestStatus: RequestStatus;
  // The provider's HTTP status when the failure was a provider response, so
  // the stored request row keeps a BAD_STATUS_CODE with its statusCode and
  // downstream consumers map it through the existing status-code taxonomy.
  statusCode?: number;

  constructor(
    message: string,
    requestStatus: RequestStatus,
    statusCode?: number,
  ) {
    super(message);
    this.name = 'PlatformProviderFetchError';
    this.requestStatus = requestStatus;
    this.statusCode = statusCode;
  }
}

export class UnknownPlatformProviderError extends PlatformProviderFetchError {
  constructor(message: string) {
    super(message, RequestStatus.FETCH_ERROR);
    this.name = 'UnknownPlatformProviderError';
  }
}

export class NoProviderAvailableError extends PlatformProviderFetchError {
  constructor(message: string) {
    super(message, RequestStatus.FETCH_ERROR);
    this.name = 'NoProviderAvailableError';
  }
}

export interface PlatformRoute {
  identity: PlatformFeedIdentity;
  adapter: PlatformProviderAdapter;
}

/**
 * Classifies a URL into the platform feed identity it carries, or null when
 * it is not a platform destination URL (including legacy platform RSS URLs,
 * which fall through to the normal fetch path). Routing and premium-gate
 * classification both key on this matcher.
 */
export type PlatformUrlMatcher = (url: string) => PlatformFeedIdentity | null;

/**
 * Durable key/value state for adapters whose remote resources must be created
 * once and then reused across fetches and processes (e.g. a vendor feed id).
 * Backed by Postgres so a restart or a different worker keeps using the same
 * remote resource instead of creating another one.
 */
export interface PlatformProviderStateStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /**
   * Stores the value only when the key is absent. Returns false when another
   * writer won the race (the stored value is left untouched).
   */
  setIfAbsent(key: string, value: string): Promise<boolean>;
  /**
   * Overwrites the value only when it still equals expectedValue
   * (compare-and-set). Returns false when another writer changed it first.
   * Backs cross-process claims (e.g. a global release-slot lease).
   */
  setIfValueIs(
    key: string,
    expectedValue: string,
    nextValue: string,
  ): Promise<boolean>;
  delete(key: string): Promise<void>;
  /**
   * Every stored key, for garbage-collection sweeps that decide which
   * identities no longer have a referencing consumer feed.
   */
  listKeys(): Promise<string[]>;
}

export interface PlatformProviderAdapterFactoryDeps {
  httpGet: PlatformHttpGet;
  stateStore?: PlatformProviderStateStore;
}

/**
 * The adapter registry the optional private package exports as
 * `platformProviderRegistry`. It owns platform knowledge wholesale: which
 * URLs belong to a platform it serves (findMatchingPlatform), the adapter
 * factories keyed [platform][providerName], and `defaults` naming each
 * platform's default provider selected when the provider env var is unset.
 */
export interface PlatformProviderRegistry {
  findMatchingPlatform(url: string): PlatformFeedIdentity | null;
  /**
   * Recovers the identity a state-store key was derived from, or null for
   * keys the package did not write. Optional so a registry predating the
   * release API still validates duck-typed.
   */
  identityFromStateKey?(key: string): PlatformFeedIdentity | null;
  adapters: Record<
    string,
    Record<
      string,
      (deps: PlatformProviderAdapterFactoryDeps) => PlatformProviderAdapter
    >
  >;
  defaults: Record<string, string>;
}

export interface PlatformProviderRouter {
  /**
   * Resolves the provider adapter for a URL, or null when the URL is not a
   * platform destination URL (including legacy platform RSS URLs, which fall
   * through to the normal fetch path). Throws typed errors for unsupported
   * platforms and unresolvable providers.
   */
  route(url: string): PlatformRoute | null;
}
