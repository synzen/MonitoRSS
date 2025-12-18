# Plan: Share Feed Processing Logic Between handleFeedV2EventInternal and Diagnostics

## Background

The article diagnostics feature (see `docs/article-diagnostics-ux-spec.md`) allows users to understand why articles would or wouldn't be delivered. However, the current diagnostic implementation doesn't accurately reflect what real feed processing does.

### Current Architecture

**Production path** (`feeds/feed-event-handler.ts`):
1. Checks stored response hash → skips if unchanged
2. Fetches feed with `requestLookupDetails` for auth/headers
3. Handles fetch exceptions (timeout, bad status, network errors)
4. Parses XML with `formatOptions`, `externalFeedProperties`, `parserRules`
5. Handles parse exceptions (invalid XML, timeout)
6. Runs `getArticlesToDeliver` with `dateChecks.datePlaceholderReferences`
7. Runs `deliverArticles` with real Discord client
8. Stores delivery records, saves response hash

**Diagnostic path** (`http/handlers/diagnose-article.ts` + `diagnostics/diagnose-articles.ts`):
1. Fetches articles via `findOrFetchFeedArticles` (no hash check, no auth, no formatOptions)
2. Runs `getArticlesToDeliver` (missing `datePlaceholderReferences`)
3. Runs `deliverArticles` with test client
4. Captures diagnostic stages via `startDiagnosticContext`

### Problems Identified

| Feature | Production | Diagnostics |
|---------|------------|-------------|
| Hash comparison (skip unchanged) | ✅ | ❌ |
| Feed fetch exceptions | ✅ Returns null | ❌ Throws |
| Feed parse exceptions | ✅ Returns null | ❌ Throws |
| `formatOptions` (date formatting) | ✅ | ❌ Empty `{}` |
| `externalFeedProperties` (content injection) | ✅ | ❌ Empty `[]` |
| `requestLookupDetails` (auth headers) | ✅ | ❌ Not passed |
| `datePlaceholderReferences` (custom date fields) | ✅ | ❌ Not in schema |
| `parserRules` (URL-specific parsing like Reddit) | ✅ | ❌ Not applied |

## Solution

Extract shared processing logic into `fetchAndParseFeed` function that both handlers use. Additionally, extract the hash lookup logic into `getHashToCompare` helper. The only differences should be:
- **Stores**: Read-only wrappers for diagnostics, real stores for production
- **Discord client**: Test client for diagnostics, real client for production
- **Diagnostic context**: Enabled for diagnostics to capture stages

### Shared Hash Lookup Logic

Both handlers have identical logic for determining whether to compare hashes:
```typescript
let hashToCompare: string | undefined;
const hasPriorArticles = await articleFieldStore.hasPriorArticlesStored(feedId);
if (hasPriorArticles) {
  const storedHash = await responseHashStore.get(feedId);
  if (storedHash) {
    hashToCompare = storedHash;
  }
}
```

This is extracted into `getHashToCompare(feedId, articleFieldStore, responseHashStore)` in `shared-processing.ts`.

## Key Decisions

### 1. Schema Reuse
**Decision**: Import existing schemas from `shared/schemas/feed-v2-event.schema.ts` instead of defining new ones.

**Rationale**: These schemas are already defined and exported:
- `feedV2EventSchemaFormatOptions`
- `feedV2EventSchemaDateChecks` (includes `datePlaceholderReferences`)
- `feedV2EventRequestLookupDetails`
- `externalFeedPropertySchema`

### 2. New Outcome Types
**Decision**: Add two new outcomes: `feed-unchanged` and `feed-error`

**Rationale**:
- `feed-unchanged`: When hash matches, feed would be skipped entirely - user should know this
- `feed-error`: Single error type with details in `outcomeReason` (simpler than multiple error types)

### 3. Caching Behavior
**Decision**: Diagnostics uses parsed articles cache like production

**Rationale**: Matches production behavior exactly, ensures consistency

### 4. Error Handling
**Decision**: Convert exceptions to typed results instead of throwing

**Rationale**: Allows handler to return appropriate outcomes instead of 500 errors

## Files to Modify

| File | Changes |
|------|---------|
| `feeds/shared-processing.ts` | **NEW** - Shared fetch/parse logic with DI support, `getHashToCompare` helper |
| `feeds/shared-processing.test.ts` | **NEW** - 13 unit tests using dependency injection |
| `feeds/feed-event-handler.ts` | Refactor to use shared logic |
| `http/handlers/diagnose-article.ts` | Use shared logic, handle new outcomes |
| `http/schemas/diagnose-article.schema.ts` | Import schemas from feed-v2-event |
| `diagnostics/types.ts` | Add `FeedUnchanged`, `FeedError` outcomes |
| `http/server.ts` | Pass `responseHashStore` to diagnostic handler |
| `test/e2e/http-api.e2e-spec.ts` | Add E2E tests for FeedUnchanged, FeedError |
| `test/helpers/test-feed-requests-server.ts` | Add hash comparison support |

## Implementation Steps (TDD)

### Step 1: Write E2E Tests for New Outcome Types

**Decision**: E2E tests in `test/e2e/http-api.e2e-spec.ts` instead of unit tests.

**Rationale**: E2E tests exercise the full HTTP stack including schema validation, handler logic, and store integration. Unit tests for error scenarios are covered in `shared-processing.test.ts` using dependency injection.

Add to `test/e2e/http-api.e2e-spec.ts`:
```typescript
describe("FeedUnchanged and FeedError outcomes", () => {
  it("returns FeedUnchanged when feed hash matches stored hash");
  it("returns FeedError when feed fetch fails");
});
```

### Step 2: Add New Outcome Types

In `diagnostics/types.ts`, add to `ArticleDiagnosisOutcome`:
```typescript
FeedUnchanged = "feed-unchanged",
FeedError = "feed-error",
```

### Step 3: Write Tests for Shared Processing (Dependency Injection Approach)

**Decision**: Use dependency injection for unit testing instead of mocking modules.

**Rationale**: The `fetchAndParseFeed` function accepts an optional `deps` parameter allowing injection of mock `fetchFeedFn` and `parseArticlesFn`. This enables targeted testing of error scenarios without complex module mocking.

**Implementation**: `feeds/shared-processing.test.ts` - 13 unit tests:

```typescript
describe("fetchAndParseFeed", () => {
  describe("fetch error handling", () => {
    it("returns fetch-error with errorType 'timeout' for FeedRequestTimedOutException");
    it("returns fetch-error with errorType 'bad-status-code' for FeedRequestBadStatusCodeException");
    it("returns fetch-error with errorType 'fetch' for FeedRequestFetchException");
    it("returns fetch-error with errorType 'internal' for FeedRequestInternalException");
    it("returns fetch-error with errorType 'parse' for FeedRequestParseException");
  });

  describe("response status handling", () => {
    it("returns pending when request status is Pending");
    it("returns matched-hash when request status is MatchedHash");
  });

  describe("parse error handling", () => {
    it("returns parse-error with errorType 'timeout' for FeedParseTimeoutException");
    it("returns parse-error with errorType 'invalid' for InvalidFeedException");
  });

  describe("success handling", () => {
    it("returns success with articles and bodyHash when fetch and parse succeed");
  });

  describe("option passing", () => {
    it("passes hashToCompare to fetch function");
    it("passes formatOptions to parse function");
    it("uses requestLookupDetails.url when provided");
  });
});
```

**Test Pattern Example**:
```typescript
it("returns fetch-error with errorType 'timeout' for FeedRequestTimedOutException", async () => {
  const result = await fetchAndParseFeed(defaultOptions, {
    fetchFeedFn: () =>
      Promise.reject(new FeedRequestTimedOutException("Request timed out")),
  });

  expect(result.status).toBe("fetch-error");
  if (result.status === "fetch-error") {
    expect(result.errorType).toBe("timeout");
    expect(result.message).toBe("Request timed out");
  }
});
```

### Step 4: Implement Shared Processing Module

Create `feeds/shared-processing.ts`:

```typescript
import { fetchFeed, FeedResponseRequestStatus } from "../feed-fetcher";
import {
  FeedRequestInternalException,
  FeedRequestParseException,
  FeedRequestBadStatusCodeException,
  FeedRequestFetchException,
  FeedRequestTimedOutException,
} from "../feed-fetcher/exceptions";
import {
  FeedParseTimeoutException,
  InvalidFeedException,
  getParserRules,
  type ExternalFeedProperty,
} from "../articles/parser";
import { parseArticlesFromXmlWithWorkers as parseArticlesFromXml } from "../articles/parser/worker";
import type { Article } from "../articles/parser";

export type FeedProcessingResult =
  | { status: "success"; articles: Article[]; bodyHash?: string }
  | { status: "matched-hash" }
  | { status: "pending" }
  | { status: "fetch-error"; errorType: string; message: string }
  | { status: "parse-error"; errorType: string; message: string };

export interface FeedProcessingOptions {
  feed: {
    url: string;
    formatOptions?: {
      dateFormat?: string;
      dateTimezone?: string;
      dateLocale?: string;
    };
    externalProperties?: ExternalFeedProperty[];
    requestLookupDetails?: {
      key: string;
      url?: string;
      headers?: Record<string, string>;
    } | null;
  };
  feedRequestsServiceHost: string;
  hashToCompare?: string;
}

/**
 * Dependencies that can be injected for testing.
 */
export interface FeedProcessingDeps {
  fetchFeedFn?: typeof fetchFeed;
  parseArticlesFn?: typeof parseArticlesFromXml;
}

export async function fetchAndParseFeed(
  options: FeedProcessingOptions,
  deps: FeedProcessingDeps = {}
): Promise<FeedProcessingResult> {
  const doFetch = deps.fetchFeedFn ?? fetchFeed;
  const doParse = deps.parseArticlesFn ?? parseArticlesFromXml;

  // 1. Fetch feed with hash comparison
  let response;
  try {
    response = await doFetch(
      options.feed.requestLookupDetails?.url || options.feed.url,
      {
        hashToCompare: options.hashToCompare,
        lookupDetails: options.feed.requestLookupDetails,
        serviceHost: options.feedRequestsServiceHost,
      }
    );
  } catch (err) {
    if (err instanceof FeedRequestInternalException) {
      return { status: "fetch-error", errorType: "internal", message: err.message };
    }
    if (err instanceof FeedRequestParseException) {
      return { status: "fetch-error", errorType: "parse", message: err.message };
    }
    if (err instanceof FeedRequestBadStatusCodeException) {
      return { status: "fetch-error", errorType: "bad-status-code", message: err.message };
    }
    if (err instanceof FeedRequestFetchException) {
      return { status: "fetch-error", errorType: "fetch", message: err.message };
    }
    if (err instanceof FeedRequestTimedOutException) {
      return { status: "fetch-error", errorType: "timeout", message: err.message };
    }
    throw err;
  }

  // 2. Check response status
  if (!response || response.requestStatus === FeedResponseRequestStatus.Pending) {
    return { status: "pending" };
  }
  if (response.requestStatus === FeedResponseRequestStatus.MatchedHash) {
    return { status: "matched-hash" };
  }

  // 3. Parse articles
  const parserRules = getParserRules({ url: options.feed.url });

  // Create external fetch function if needed
  const externalFetchFn = options.feed.externalProperties?.length
    ? async (url: string) => {
        try {
          const res = await fetchFeed(url, {
            executeFetchIfNotInCache: true,
            retries: 3,
            serviceHost: options.feedRequestsServiceHost,
          });
          return res.requestStatus === FeedResponseRequestStatus.Success ? res.body : null;
        } catch {
          return null;
        }
      }
    : undefined;

  try {
    const result = await parseArticlesFromXml(response.body, {
      timeout: 10000,
      formatOptions: options.feed.formatOptions,
      useParserRules: parserRules,
      externalFeedProperties: options.feed.externalProperties,
      externalFetchFn,
    });

    return {
      status: "success",
      articles: result.articles,
      bodyHash: response.bodyHash,
    };
  } catch (err) {
    if (err instanceof FeedParseTimeoutException) {
      return { status: "parse-error", errorType: "timeout", message: err.message };
    }
    if (err instanceof InvalidFeedException) {
      return { status: "parse-error", errorType: "invalid", message: err.message };
    }
    throw err;
  }
}
```

### Step 5: Update Schema (Reuse Existing)

In `http/schemas/diagnose-article.schema.ts`:

```typescript
import {
  feedV2EventSchemaFormatOptions,
  feedV2EventSchemaDateChecks,
  feedV2EventRequestLookupDetails,
  externalFeedPropertySchema,
} from "../../shared/schemas";

const feedSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  blockingComparisons: z.array(z.string()).default([]),
  passingComparisons: z.array(z.string()).default([]),
  dateChecks: feedV2EventSchemaDateChecks.optional(),
  formatOptions: feedV2EventSchemaFormatOptions.optional(),
  externalProperties: z.array(externalFeedPropertySchema).optional().default([]),
  requestLookupDetails: feedV2EventRequestLookupDetails.optional().nullable(),
});
```

### Step 6: Update Diagnostic Handler

In `http/handlers/diagnose-article.ts`:

```typescript
export async function handleDiagnoseArticle(
  req: Request,
  feedRequestsServiceHost: string,
  articleFieldStore: ArticleFieldStore,
  deliveryRecordStore: DeliveryRecordStore,
  responseHashStore: ResponseHashStore  // NEW parameter
): Promise<Response> {
  // ... existing auth wrapper ...

  // Get stored hash for comparison
  let hashToCompare: string | undefined;
  const hasPriorArticles = await articleFieldStore.hasPriorArticlesStored(input.feed.id);
  if (hasPriorArticles) {
    const storedHash = await responseHashStore.get(input.feed.id);
    if (storedHash) {
      hashToCompare = storedHash;
    }
  }

  // Use shared processing
  const feedResult = await fetchAndParseFeed({
    feed: {
      url: input.feed.url,
      formatOptions: input.feed.formatOptions,
      externalProperties: input.feed.externalProperties,
      requestLookupDetails: input.feed.requestLookupDetails,
    },
    feedRequestsServiceHost,
    hashToCompare,
  });

  // Handle non-success results
  if (feedResult.status === "matched-hash") {
    return jsonResponse({
      results: input.articleIds.map(articleId => ({
        articleId,
        articleIdHash: null,
        articleTitle: null,
        outcome: ArticleDiagnosisOutcome.FeedUnchanged,
        outcomeReason: "Feed content has not changed since last processing.",
      })),
      errors: [],
    });
  }

  if (feedResult.status === "pending") {
    return jsonResponse({
      results: [],
      errors: [{ articleId: "*", message: "Feed request is pending. Try again later." }],
    });
  }

  if (feedResult.status === "fetch-error" || feedResult.status === "parse-error") {
    const errorDesc = feedResult.status === "fetch-error" ? "fetch" : "parse";
    return jsonResponse({
      results: input.articleIds.map(articleId => ({
        articleId,
        articleIdHash: null,
        articleTitle: null,
        outcome: ArticleDiagnosisOutcome.FeedError,
        outcomeReason: `Feed ${errorDesc} error (${feedResult.errorType}): ${feedResult.message}`,
      })),
      errors: [],
    });
  }

  // Success - continue with diagnosis
  const fetchArticles = async () => feedResult.articles;
  // ... rest of existing logic ...
}
```

### Step 7: Update Server

In `http/server.ts`, pass `responseHashStore` to handler.

### Step 8: Refactor handleFeedV2EventInternal

Replace inline fetch/parse logic with `fetchAndParseFeed`, keeping existing logging and retry behavior.

### Step 9: Run All Tests

```bash
bun test
./test-e2e.sh
```

## Test Infrastructure Changes

### Test Feed Requests Server Enhancement

The `test/helpers/test-feed-requests-server.ts` was enhanced to support hash comparison for testing the `FeedUnchanged` outcome:

```typescript
// If hashToCompare matches, return MatchedHash status (simulates unchanged feed)
if (body.hashToCompare && body.hashToCompare === computedHash) {
  return Response.json({
    requestStatus: FeedResponseRequestStatus.MatchedHash,
    response: {
      body: "",
      hash: computedHash,
      statusCode: 200,
    },
  });
}
```

### E2E Tests for New Outcomes

Added to `test/e2e/http-api.e2e-spec.ts`:

```typescript
describe("POST /diagnose-article", () => {
  // ... existing tests ...

  describe("FeedUnchanged and FeedError outcomes", () => {
    it("returns FeedUnchanged when feed hash matches stored hash", async () => {
      // Setup: Store a hash in responseHashStore
      // Request: Send diagnose request with same feed content
      // Assert: outcome === "feed-unchanged"
    });

    it("returns FeedError when feed fetch fails", async () => {
      // Setup: Register URL to return error response
      // Request: Send diagnose request
      // Assert: outcome === "feed-error", outcomeReason contains error details
    });
  });
});
```

**Test Configuration Update**: `http-api.e2e-spec.ts` server setup now passes `responseHashStore`:

```typescript
httpServer = await startHttpServer({
  port: 0,
  articleFieldStore,
  deliveryRecordStore,
  responseHashStore,  // NEW
  feedRequestsServiceHost: `http://localhost:${testFeedRequestsServer.port}`,
});
```

## Test Summary

| Test File | Test Count | Coverage |
|-----------|------------|----------|
| `feeds/shared-processing.test.ts` | 13 | All error types, response statuses, option passing |
| `test/e2e/http-api.e2e-spec.ts` | 2 (new) | FeedUnchanged, FeedError outcomes |

**Total Unit Tests**: 407 (all passing)

## Outcome Mapping

| Scenario | Outcome | User-Facing Label |
|----------|---------|-------------------|
| Hash matches stored | `feed-unchanged` | "No Changes" |
| Fetch exception | `feed-error` | "Feed Error" |
| Parse exception | `feed-error` | "Feed Error" |
| Success → existing logic | (existing outcomes) | (existing labels) |

## Notes

- **Caching**: Diagnostics uses parsed articles cache like production
- **Retry logic**: Only production handler does retry tracking for invalid feeds
- **Read-only stores**: Diagnostics wraps `articleFieldStore` in read-only wrapper (already implemented)
- **Test Discord client**: Diagnostics uses `createTestDiscordRestClient()` (already implemented)

## Related Files Reference

**Implementation**:
- Feed Event Handler: `feeds/feed-event-handler.ts`
- Shared Processing: `feeds/shared-processing.ts`
- Diagnostic Handler: `http/handlers/diagnose-article.ts`
- Diagnostic Types: `diagnostics/types.ts`
- Diagnostic Context: `diagnostics/diagnostic-context.ts`
- Feed V2 Event Schema: `shared/schemas/feed-v2-event.schema.ts`

**Tests**:
- Shared Processing Unit Tests: `feeds/shared-processing.test.ts` (13 tests)
- E2E Tests: `test/e2e/http-api.e2e-spec.ts`
- Test Feed Server: `test/helpers/test-feed-requests-server.ts`
- Test Setup: `test/helpers/setup-integration-tests.ts`

**Documentation**:
- UX Spec: `docs/article-diagnostics-ux-spec.md`
