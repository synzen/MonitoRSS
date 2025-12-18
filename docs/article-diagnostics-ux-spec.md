# Article Diagnostics UX Specification

## Problem Statement

Users complain that articles visible in their RSS feed aren't being delivered to Discord. The service lacks transparency into why articles are filtered/skipped during processing. This feature adds visibility into why articles may not get delivered.

## Backend API (Already Implemented)

A diagnostic API exists in `user-feeds-next` at `POST /v1/user-feeds/diagnose-articles` that analyzes why articles would or would not be delivered.

### Diagnostic Outcomes

| API Outcome | User-Facing Label | Description |
|-------------|-------------------|-------------|
| `would-deliver` | Would Deliver | Article would be delivered successfully |
| `first-run-baseline` | Learning | Feed is new, articles stored but not delivered to prevent flooding |
| `duplicate-id` | Previously Seen | Article ID already seen |
| `blocked-by-comparison` | Unchanged | Article blocked by comparison fields (content unchanged) |
| `filtered-by-date-check` | Too Old | Article filtered out by date checks |
| `filtered-by-medium-filter` | Blocked by Filters | Article filtered by connection-specific filters |
| `rate-limited-feed` | Daily Limit Reached | Would exceed feed's daily article limit |
| `rate-limited-medium` | Limit Reached | Would exceed connection's rate limits |
| `would-deliver-passing-comparison` | Would Deliver | Already seen but tracked field changed, will be delivered |

### Diagnostic Stages (for delivery checks view)

- `feed-state` → "Feed State" - Is this a first run?
- `id-comparison` → "Duplicate Check" - Is the article ID new?
- `blocking-comparison` → "Blocking Comparison" - Do blocking fields match previous?
- `passing-comparison` → "Passing Comparison" - Did passing fields change?
- `date-check` → "Date Check" - Is article within date threshold?
- `medium-filter` → "Connection Filters" - Does article pass connection filters?
- `feed-rate-limit` → "Feed Rate Limit" - Is feed under daily limit?
- `medium-rate-limit` → "Connection Rate Limit" - Is connection under rate limit?

## UX Decisions

### Location

**Decision:** New "Delivery Preview" section in the existing Logs tab

**Rationale:**
- Logs tab already contains Request History and Delivery History
- Users troubleshooting naturally go to Logs first
- Avoids adding a 6th top-level tab (mobile responsiveness concerns)
- Mental model: Request History (did fetch work?) → Delivery History (what was sent?) → Delivery Preview (what will happen next?)

### Default View

**Decision:** Multiple articles overview with paginated "Load more"

**Rationale:**
- Users typically say "nothing is working" rather than pointing to a specific article
- Need to see patterns across multiple articles (e.g., "all articles are Learning")
- Single-article picker doesn't help when users don't know which article to investigate

### Visual Layout

```
Delivery Preview                 Preview generated: 2 min ago  [Refresh]
Preview how articles will be handled when your feed is next processed.
-----------------------------------------------------------------
| Status              | Article Title                           |
|---------------------|------------------------------------------|
| Learning            | "Breaking News: Market Update..."       |
| Learning            | "Tech Update: New Phone Released..."    |
| Learning            | "Sports: Championship Game Tonight..."  |
| Learning            | "Weather Alert: Storm Warning..."       |
| Learning            | "Politics: New Policy Announced..."     |
-----------------------------------------------------------------
                                                      [Load more]

Pattern Alert (shown when dominant outcome detected):
"This feed is in its learning phase. MonitoRSS is identifying
existing articles so it only delivers new ones. This typically
completes within **10 minutes**."

Note: The time shown is the feed's `refreshRateSeconds` formatted in human-readable
form (e.g., "10 minutes", "1 hour", "6 hours"). This tells users how long to wait.
```

### Page Size

**Decision:** 10 articles per page

**Rationale:**
- Fast initial load (diagnostic API processes each article)
- Enough to spot patterns
- Fits typical viewport without scrolling
- Load more is one click away if needed

### Load More Behavior

**Decision:** Append (container grows taller)

**Rationale:**
- Users can see all loaded articles at once
- Easy to spot patterns across everything
- Can compare multiple articles without losing context
- Users troubleshooting want to see the full picture

### Drill-Down Interaction

**Decision:** Expandable rows (accordion style)

**Rationale:**
- Keeps list context visible
- Users can expand multiple articles to compare
- No modal juggling when checking several articles
- Pattern alert at top stays visible

### Expanded Row Layout

```
-----------------------------------------------------------------
| Learning            | "Breaking News: Market Update..."       |
|---------------------------------------------------------------|
| Details                                                        |
|                                                                |
| Skipped (Learning Phase): This article existed before the      |
| feed was added. MonitoRSS skips pre-existing articles to       |
| avoid flooding your channel with old content. New articles     |
| will be delivered to all 2 connections once learning           |
| completes (within 10 minutes).                                 |
|                                                                |
| [View Delivery Checks]                                         |
-----------------------------------------------------------------
```

Note: During the learning phase, the per-connection table is omitted since all
connections have the same outcome. The table is shown for other statuses where
per-connection results may differ.

### Per-Connection Breakdown

**Decision:** Always show a table of active connections

**Rationale:**
- Disabled connections are excluded (they won't receive articles anyway)
- Consistent display whether outcomes match or differ
- No conditional "summary vs table" logic

### Detail Levels (Progressive Disclosure)

1. **Level 1 - Summary (default):** Status badge + human-readable reason
2. **Level 2 - Expanded:** Per-connection table with specific reasons
3. **Level 3 - Delivery Checks:** All diagnostic stages for power users (opens in modal)

### Fetch Trigger

**Decision:** Automatic on section load

**Rationale:**
- Users in Logs tab are already troubleshooting
- They expect to see data when they arrive
- Extra button click adds friction for frustrated users

### Loading UI

**Decision:** Skeleton rows (prevents layout shift)

**Rationale:**
- Loading spinner with text would cause height jump when data loads
- Skeleton rows reserve space and transition smoothly
- Chakra UI has built-in Skeleton components

```
Delivery Preview                                         [Refresh]
-----------------------------------------------------------------
| ████████████        | ██████████████████████████████████████  |
| ████████████        | ██████████████████████████████████████  |
| ████████████        | ██████████████████████████████████████  |
| ████████████        | ██████████████████████████████████████  |
| ████████████        | ██████████████████████████████████████  |
-----------------------------------------------------------------
                                                      [Load more]
```

### Refresh Behavior

**Decision:** Manual refresh button + "Preview generated" timestamp

**Rationale:**
- Auto-refresh can be jarring (UI jumps, unexpected loading)
- Users troubleshooting want control
- Timestamp helps users know if data is stale
- Avoids unnecessary API calls

### Pattern Alert

**Decision:** Show alert when dominant outcome is clear

**Rationale:**
- Helps users immediately understand systemic issues
- Some outcomes are feed-level (first run applies to all articles)
- Provides plain-language explanation without expanding every row

**Threshold:** For feed-level states like "Learning", threshold is effectively 1 (if one article has it, all do). For "Previously Seen" (duplicate-id), threshold is 100% (all articles must have this outcome). For other per-article outcomes, show when pattern is dominant.

### No Connections State

**Decision:** Show message with "Add Connection" button instead of diagnostics

**Rationale:**
- Diagnostics aren't actionable without connections
- User's first step should be adding a connection
- Avoids confusion ("it says it would deliver, but where?")

```
Delivery Preview                 Preview generated: just now  [Refresh]
-----------------------------------------------------------------
| No active connections                                          |
|                                                                |
| Add a connection to specify where articles should be delivered.|
| Article diagnostics will be available once you have at least   |
| one active connection.                                         |
|                                                                |
| [Add Connection]                                               |
-----------------------------------------------------------------
```

### Empty State (No Articles)

**Decision:** Reuse existing request status messages from the control panel

**Rationale:**
- Consistency with existing patterns
- Messages already exist for: feed empty, feed not found, auth missing, etc.
- Points user to Request History for more context

### Error State (API Failure)

**Decision:** Follow existing error patterns in the app

**Rationale:**
- Consistency with how other API failures are handled
- Use Chakra's Alert with status="error"
- Keep Retry button available

## Status Badge Colors

| Outcome Type | Color | Icon |
|--------------|-------|------|
| Would deliver | green | Check |
| First run baseline | blue | Info |
| Duplicate/No changes | gray | Repeat |
| Filtered/Blocked | orange | Warning |
| Rate limited | yellow | Clock |
| Error | red | X |

## User-Friendly Copy

| API Outcome | Explanation Text |
|-------------|------------------|
| `would-deliver` | This article will be delivered to Discord when your feed is next processed. |
| `first-run-baseline` | This feed is in its learning phase. MonitoRSS skips pre-existing articles to avoid flooding your channel with old content. |
| `duplicate-id` | MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added. Either way, it won't be sent again to avoid duplicates. |
| `blocked-by-comparison` | The fields in your Blocking Comparisons haven't changed since this article was last checked. |
| `filtered-by-date-check` | This article's publish date is older than your maximum article age setting. Adjust date settings if you want older articles delivered. |
| `filtered-by-medium-filter` | This article doesn't match the filter rules for your connection. Review your filter settings to adjust what gets delivered. |
| `rate-limited-feed` | Your feed has delivered the maximum articles allowed in a 24-hour period. Delivery resumes automatically as older deliveries fall outside this window. Upgrade your plan for higher limits. |
| `rate-limited-medium` | This connection has reached its delivery limit. The article will be delivered automatically once the limit resets. |
| `would-deliver-passing-comparison` | This article was seen before, but one of your Passing Comparison fields changed, so it will be delivered. |

## Delivery Checks View (Level 3)

For power users who need to see exactly what happened at each stage of the delivery process.

**Trigger:** "View Delivery Checks" text link in expanded row details (opens modal)

### Learning Phase Modal

During the learning phase, the modal shows an educational message instead of the
stage-by-stage breakdown (since all stages would show "Skipped" anyway):

```
┌─────────────────────────────────────────────────────────────────┐
│ Delivery Checks                                             [X] │
│ "Breaking News: Market Update..."                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ℹ️  Learning Phase Active                                      │
│                                                                 │
│  This feed is in its learning phase. MonitoRSS is identifying   │
│  existing articles so it only delivers new ones.                │
│                                                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Expected completion: Within 10 minutes                    │  │
│  │ Based on your feed's refresh interval                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Delivery checks will be available once the feed begins         │
│  normal operation.                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rationale:**
- Keeps button visible for discoverability and consistency
- Provides education instead of confusing "Skipped" stages
- Prepares users for the full feature once learning completes
- Shows expected completion time based on feed's refresh interval

### Modal Overview

Uses a **subtle background strip** pattern instead of bordered boxes for expanded details.
This reduces visual nesting and maintains reading flow.

```
┌─────────────────────────────────────────────────────────────────┐
│ Delivery Checks                                             [X] │
│ "Breaking News: Market Reaches All-Time High Today"             │
│                                                                 │
│ Connection: #announcements                           [Dropdown] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ > ✓  Feed State            Not first run                        │
│                                                                 │
│ > ✓  Duplicate Check       Article ID is new                    │
│                                                                 │
│ v ✗  Blocking Comparison   description field unchanged          │
│ ┃                                                               │
│ ┃  Selected Fields       description, content                   │
│ ┃  Available Fields      description                            │
│ ┃  Blocked By            description (no change detected)       │
│                                                                 │
│   —  Passing Comparison    Skipped (earlier check failed)       │
│                                                                 │
│   —  Date Check            Skipped                              │
│                                                                 │
│   —  Connection Filters    Skipped                              │
│                                                                 │
│   —  Feed Rate Limit       Skipped                              │
│                                                                 │
│   —  Connection Rate Limit Skipped                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modal Components

**Header:**
- Title: "Delivery Checks"
- Close button (X) in top right
- Article title displayed below (truncated with ellipsis if too long)
- Connection selector dropdown (when multiple connections)

**Connection Selector:**
- Dropdown to switch between connections when article has mixed results
- Shows connection name/icon (e.g., #channel-name, @webhook-name)
- Default: First connection or the one that caused the block

### Stage Row Design

Uses a **subtle background strip** pattern: expanded details use only a colored left border
with subtle background, avoiding the visual heaviness of bordered boxes.

**Collapsed Row:**
```
[>] [Icon] Stage Name         Brief summary text
```

- `[>]` = Chevron (clickable to expand)
- `[Icon]` = Status icon (✓ green / ✗ red / — gray)
- Stage Name = Human-readable stage name
- Brief summary = One-line explanation

**Expanded Row (Passed):**
```
[v] ✓  Feed State            Not first run
┃
┃  Has Prior Articles    Yes
┃  Is First Run          No
┃  Stored Comparisons    title, description
```

- Green left border (3px)
- No background or very subtle gray background
- Details are indented and aligned with stage content

**Expanded Row (Failed - Auto-expanded by default):**
```
[v] ✗  Blocking Comparison   description field unchanged
┃
┃  Selected Fields       description, content
┃  Available Fields      description
┃  Blocked By            description (no change detected)
```

- Red left border (3px)
- Subtle red background tint (very low opacity to avoid alarm fatigue)
- Details are indented and aligned with stage content

**Skipped Row (Not expandable):**
```
    —  Passing Comparison    Skipped (earlier check failed)
```

- No chevron (nothing to expand)
- Gray dash icon
- Gray/muted text
- Brief explanation of why skipped

### Stage-Specific Expanded Details

Details are shown as simple property lists with a colored left border (no box).

**Feed State (Passed/Failed):**
```
┃  Has Prior Articles    Yes
┃  Is First Run          No
┃  Stored Comparisons    title, description, content
```

**Duplicate Check (Passed/Failed):**
```
┃  Is New                Yes
```

**Blocking Comparison (Passed/Failed):**
```
┃  Selected Fields       description, content
┃  Available Fields      description
┃  Blocked By            description (no change)
```

**Passing Comparison (Passed/Failed):**
```
┃  Selected Fields       title, author
┃  Available Fields      title
┃  Changed Fields        title (triggered re-delivery)
```

**Date Check (Passed/Failed):**
```
┃  Article Date          2024-01-15 10:30:00 UTC
┃  Age                   2 days, 4 hours
┃  Maximum Age           7 days
┃  Within Limit          Yes
```

**Connection Filters (Passed/Failed):**
```
┃  Filter Result         Blocked
┃  Blocked Because:
┃    • title must contain "urgent"
┃    • category must not equal "sports"
```

**Feed Rate Limit (Passed/Failed):**
```
┃  Current Count         47 articles
┃  Limit                 50 articles
┃  Time Window           1 day
┃  Remaining             3 articles
┃  Over Limit            No
```

**Connection Rate Limit (Passed/Failed):**
```
┃  Current Count         10 articles
┃  Limit                 10 articles
┃  Time Window           1 hour
┃  Remaining             0 articles
┃  Over Limit            Yes
```

### Visual Design Specifications

**Status Icons:**
| Status  | Icon | Color | Background |
|---------|------|-------|------------|
| Passed  | ✓ (check) | green.400 | none |
| Failed  | ✗ (x-mark) | white | none (high contrast against red.900 row background) |
| Skipped | — (dash) | gray.500 | none |

**Row Styling:**
- Passed rows: Default background, subtle left border (green.200, 3px)
- Failed rows: Very subtle red background (red.900 with low opacity in dark mode), left border (red.400, 3px)
- Skipped rows: Muted text (gray.500), reduced opacity, no border

**Detail Panel (Subtle Background Strip):**
- No box border - uses only left border inherited from parent row
- Padding: 12px left (pl-4), 8px vertical (py-2)
- Margin-left: Aligned with stage name (ml-10 or similar)
- Font: Monospace for values, regular for labels
- Background: Inherits from row (subtle red for failed, none for passed)

**Typography:**
- Stage name: font-weight: 600 (semibold)
- Summary text: font-weight: 400 (normal)
- Detail labels: font-weight: 500, color: gray.600
- Detail values: font-weight: 400

### Interaction Behavior

**Auto-expand Failed Stage:**
- When modal opens, automatically expand the failed stage
- User can collapse it manually
- If multiple failures (rare), expand the first one

**Chevron Animation:**
- Rotate 90° when expanding (> to v)
- Smooth transition: 150ms ease-out

**Detail Panel Animation:**
- Slide down with height transition
- Chakra Collapse component with animateOpacity

**Connection Dropdown:**
- Changes all stage results to show that connection's checks
- Resets expansion state (re-expands failed stage for new connection)

### Mobile Layout

```
┌─────────────────────────────────┐
│ Delivery Checks             [X] │
│ "Breaking News: Market..."      │
│                                 │
│ Connection:                     │
│ [#announcements          v]     │
├─────────────────────────────────┤
│                                 │
│ > ✓  Feed State                 │
│      Not first run              │
│                                 │
│ > ✓  Duplicate Check            │
│      Article ID is new          │
│                                 │
│ v ✗  Blocking Comparison        │
│      description unchanged      │
│ ┃                               │
│ ┃  Selected Fields              │
│ ┃  description, content         │
│ ┃                               │
│ ┃  Available Fields             │
│ ┃  description                  │
│ ┃                               │
│ ┃  Blocked By                   │
│ ┃  description (no change)      │
│                                 │
│   —  Passing Comparison         │
│      Skipped                    │
│                                 │
│   ...                           │
└─────────────────────────────────┘
```

- Full-width modal (no side margins)
- Stage name and summary stack vertically
- Dropdown is full-width
- Larger tap targets (48px row height)

**Status indicators:**
- Passed = Green check
- Failed = Red X (this stage caused the block)
- Skipped = Gray dash (check not reached - earlier check failed)

## Partially Deliverable State

When an article would deliver to some connections but not others.

**Summary Row:**

```
| Partial             | "Tech Update: New Features Released"    |
```

Uses yellow/orange badge to indicate mixed results.

**Expanded Details:**

```
-----------------------------------------------------------------
| Partial             | "Tech Update: New Features Released"    |
|---------------------------------------------------------------|
| Details                                                        |
|                                                                |
| This article would deliver to some connections but not others. |
|                                                                |
| Connections:                                                   |
| | #announcements    | Would deliver                          | |
| | #tech-news        | Blocked by filters                     | |
| |                   |   title contains "update"              | |
| | @news-webhook     | Rate limited (5/5 today)               | |
|                                                                |
| [View Delivery Checks]                                         |
-----------------------------------------------------------------
```

**Logic for determining summary status:**
- All connections would deliver -> "Would Deliver" (green)
- All connections blocked for same reason -> Show that reason (e.g., "Learning")
- Mixed results -> "Mixed Results" (yellow/orange)
- All connections blocked (different reasons) -> Show most common reason or "Blocked"

## Interaction Details

### Row Expansion

**Trigger:** Click anywhere on the row (entire row is clickable)

**Visual indicator:** Chevron icon on the left side
- `>` when collapsed
- `v` when expanded

**Animation:** Smooth height transition (200-300ms ease-out)
- Content fades in as it expands
- Use Chakra's `Collapse` component

### Multiple Expanded Rows

**Behavior:** Multiple rows can be expanded simultaneously
- No accordion behavior (expanding one doesn't collapse others)
- Users comparing articles need to see multiple expanded at once

### Refresh Button

**Behavior:**
- Shows loading spinner while fetching
- Disables button during fetch
- Updates "Preview generated" timestamp on completion
- Collapses all expanded rows on refresh (data may have changed)

### Load More Button

**Behavior:**
- Shows loading spinner while fetching
- Appends skeleton rows below existing content
- Skeleton rows transition to real content
- Does NOT collapse existing expanded rows

### Hover States

- Row background highlights on hover (subtle gray)
- Cursor changes to pointer to indicate clickability

## Mobile Responsiveness

### Breakpoint Behavior

**Desktop (>768px):** Full two-column table layout

```
| Status              | Article Title                           |
```

**Mobile (<768px):** Stacked card layout

```
---------------------------------
| "Breaking News: Market..."    |
| Status: Learning              |
---------------------------------
| "Tech Update: New Phone..."   |
| Status: Learning              |
---------------------------------
```

### Expanded Details on Mobile

- Full width, stacked layout
- Connection table becomes list (for non-learning statuses):

```
Connections:

#announcements
  Would deliver

#tech-news
  Blocked by filters
  -> title contains "update"

@news-webhook
  Rate limited (5/5 today)
```

For learning phase, the simplified format is used (no per-connection list):

```
Skipped (Learning Phase): This article existed before the feed
was added. MonitoRSS skips pre-existing articles to avoid
flooding your channel with old content. New articles will be
delivered to all 2 connections once learning completes (within
10 minutes).
```

### Touch Considerations

- Larger tap targets (minimum 44px height for rows)
- Expand/collapse works with tap
- No hover-dependent interactions

## API Types

### Request Schema

```typescript
interface DiagnoseArticleInput {
  feed: {
    id: string;
    url: string;
    blockingComparisons: string[];  // default: []
    passingComparisons: string[];   // default: []
    dateChecks?: {
      oldArticleDateDiffMsThreshold?: number;
    };
  };
  mediums: Array<{
    id: string;
    rateLimits?: Array<{
      limit: number;
      timeWindowSeconds: number;
    }>;
    filters?: {
      expression: unknown;  // Filter expression evaluated at runtime
    };
  }>;
  articleDayLimit: number;
  articleIds: string[];      // min: 1, max: 50
  summaryOnly: boolean;      // default: false
}
```

### Response Schema

```typescript
interface DiagnoseArticlesResponse {
  results: ArticleDiagnosticResult[] | ArticleDiagnosisSummary[];
  errors: Array<{ articleId: string; message: string }>;
}

// Full result (when summaryOnly: false)
interface ArticleDiagnosticResult {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
  stages: DiagnosticStageResult[];
}

// Summary result (when summaryOnly: true)
interface ArticleDiagnosisSummary {
  articleId: string;
  articleIdHash: string;
  articleTitle: string | null;
  outcome: ArticleDiagnosisOutcome;
  outcomeReason: string;
}
```

### Diagnostic Stage Details

```typescript
// Feed State
interface FeedStateDiagnosticDetails {
  hasPriorArticles: boolean;
  isFirstRun: boolean;
  storedComparisonNames: string[];
}

// ID Comparison
interface IdComparisonDiagnosticDetails {
  articleIdHash: string;
  foundInHotPartition: boolean;
  foundInColdPartition: boolean;
  isNew: boolean;
}

// Blocking Comparison
interface BlockingComparisonDiagnosticDetails {
  comparisonFields: string[];
  activeFields: string[];
  blockedByFields: string[];
}

// Passing Comparison
interface PassingComparisonDiagnosticDetails {
  comparisonFields: string[];
  activeFields: string[];
  changedFields: string[];
}

// Date Check
interface DateCheckDiagnosticDetails {
  articleDate: string | null;
  threshold: number | null;
  datePlaceholders: string[];
  ageMs: number | null;
  withinThreshold: boolean;
}

// Medium Filter
interface MediumFilterDiagnosticDetails {
  mediumId: string;
  filterExpression: unknown | null;
  filterResult: boolean;
  explainBlocked: string[];
}

// Rate Limit (feed and medium)
interface RateLimitDiagnosticDetails {
  currentCount: number;
  limit: number;
  timeWindowSeconds: number;
  remaining: number;
  wouldExceed: boolean;
}
```

### Outcome Enum Values

```typescript
enum ArticleDiagnosisOutcome {
  WouldDeliver = "would-deliver",
  FirstRunBaseline = "first-run-baseline",
  DuplicateId = "duplicate-id",
  BlockedByComparison = "blocked-by-comparison",
  FilteredByDateCheck = "filtered-by-date-check",
  FilteredByMediumFilter = "filtered-by-medium-filter",
  RateLimitedFeed = "rate-limited-feed",
  RateLimitedMedium = "rate-limited-medium",
  WouldDeliverPassingComparison = "would-deliver-passing-comparison",
}
```

## Implementation Notes

### Files to Create/Modify

**Frontend (services/backend-api/client/):**
- `src/features/feed/components/UserFeedLogs/ArticleStatus/index.tsx` - Main component
- `src/features/feed/components/UserFeedLogs/ArticleStatus/ArticleStatusRow.tsx` - Row with expand
- `src/features/feed/components/UserFeedLogs/ArticleStatus/ArticleDiagnosticDetails.tsx` - Expanded details
- `src/features/feed/components/UserFeedLogs/ArticleStatus/DeliveryChecksModal.tsx` - Delivery checks modal (Level 3)
- `src/features/feed/hooks/useArticleDiagnostics.tsx` - API hook with pagination
- `src/features/feed/components/UserFeedLogs/index.tsx` - Add ArticleStatus section

**Backend API (services/backend-api/):**
- New controller/endpoint to proxy to user-feeds-next diagnose-article API
- Handle authentication and request transformation

### Existing Patterns to Follow

- Look at `RequestHistory` and `DeliveryHistory` for component patterns
- Look at `useUserFeedRequestsWithPagination` for pagination hook patterns
- Look at existing Chakra Alert usage for error/empty states
- Look at existing skeleton loading patterns in the app

### API Request Shape

The frontend will need to call the diagnostic API with:
- Feed ID
- Feed URL
- Feed settings (blocking/passing comparisons, date checks)
- Connection (medium) IDs and their filters/rate limits
- Article day limit
- Pagination (skip/limit for articles)
