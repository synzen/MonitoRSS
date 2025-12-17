# Article Diagnostics UX Specification

## Problem Statement

Users complain that articles visible in their RSS feed aren't being delivered to Discord. The service lacks transparency into why articles are filtered/skipped during processing. This feature adds visibility into why articles may not get delivered.

## Backend API (Already Implemented)

A diagnostic API exists in `user-feeds-next` at `POST /v1/user-feeds/diagnose-articles` that analyzes why articles would or would not be delivered.

### Diagnostic Outcomes

| API Outcome | User-Facing Label | Description |
|-------------|-------------------|-------------|
| `would-deliver` | Would Deliver | Article would be delivered successfully |
| `first-run-baseline` | First Run Setup | Feed is new, articles stored but not delivered to prevent flooding |
| `duplicate-id` | Already Delivered | Article ID already seen |
| `blocked-by-comparison` | No Changes Detected | Article blocked by comparison fields (content unchanged) |
| `filtered-by-date-check` | Too Old | Article filtered out by date checks |
| `filtered-by-medium-filter` | Blocked by Filters | Article filtered by connection-specific filters |
| `rate-limited-feed` | Daily Limit Reached | Would exceed feed's daily article limit |
| `rate-limited-medium` | Connection Rate Limited | Would exceed connection's rate limits |
| `would-deliver-passing-comparison` | Delivering Update | Already seen but tracked field changed, will re-deliver |

### Diagnostic Stages (for delivery checks view)

- `feed-state` - Is this a first run?
- `id-comparison` - Is the article ID new?
- `blocking-comparison` - Do blocking fields match previous?
- `passing-comparison` - Did passing fields change?
- `date-check` - Is article within date threshold?
- `medium-filter` - Does article pass connection filters?
- `feed-rate-limit` - Is feed under daily limit?
- `medium-rate-limit` - Is connection under rate limit?

## UX Decisions

### Location

**Decision:** New "Article Status" section in the existing Logs tab

**Rationale:**
- Logs tab already contains Request History and Delivery History
- Users troubleshooting naturally go to Logs first
- Avoids adding a 6th top-level tab (mobile responsiveness concerns)
- Mental model: Request History (did fetch work?) → Delivery History (what was sent?) → Article Status (why wasn't this delivered?)

### Default View

**Decision:** Multiple articles overview with paginated "Load more"

**Rationale:**
- Users typically say "nothing is working" rather than pointing to a specific article
- Need to see patterns across multiple articles (e.g., "all articles are First Run")
- Single-article picker doesn't help when users don't know which article to investigate

### Visual Layout

```
Article Status                    Last checked: 2 min ago  [Refresh]
-----------------------------------------------------------------
| Status              | Article Title                           |
|---------------------|------------------------------------------|
| First Run           | "Breaking News: Market Update..."       |
| First Run           | "Tech Update: New Phone Released..."    |
| First Run           | "Sports: Championship Game Tonight..."  |
| First Run           | "Weather Alert: Storm Warning..."       |
| First Run           | "Politics: New Policy Announced..."     |
-----------------------------------------------------------------
                                                      [Load more]

Pattern Alert (shown when dominant outcome detected):
"This feed is new. Articles are being recorded but not delivered
yet to prevent flooding your channel."
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
| First Run           | "Breaking News: Market Update..."       |
|---------------------------------------------------------------|
| Details                                                        |
|                                                                |
| This feed is new. Articles are being recorded but not          |
| delivered yet to prevent flooding your channels.               |
|                                                                |
| Connections:                                                   |
| | #announcements    | Would deliver after first run          | |
| | #tech-news        | Would deliver after first run          | |
|                                                                |
| [View Delivery Checks]                                         |
-----------------------------------------------------------------
```

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
Article Status                                           [Refresh]
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

**Decision:** Manual refresh button + "Last checked" timestamp

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

**Threshold:** For feed-level states like "First Run", threshold is effectively 1 (if one article has it, all do). For per-article outcomes, show when pattern is dominant.

### No Connections State

**Decision:** Show message with "Add Connection" button instead of diagnostics

**Rationale:**
- Diagnostics aren't actionable without connections
- User's first step should be adding a connection
- Avoids confusion ("it says it would deliver, but where?")

```
Article Status                    Last checked: just now  [Refresh]
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
| `would-deliver` | This article would be delivered to Discord when the feed is next processed. |
| `first-run-baseline` | This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel with old content. New articles will be delivered after this initial setup. |
| `duplicate-id` | This article was already delivered. Its unique ID matches a previously sent article. |
| `blocked-by-comparison` | This article hasn't changed since it was last checked. The monitored fields (like title or description) are identical to the previous version. |
| `filtered-by-date-check` | This article's publish date is older than your configured threshold. Adjust date settings if you want older articles delivered. |
| `filtered-by-medium-filter` | This article doesn't match the filter rules for [Connection Name]. Review your filter settings to adjust what gets delivered. |
| `rate-limited-feed` | Your feed has hit its daily article limit ({current}/{max}). Upgrade your plan or wait until tomorrow for more articles. |
| `rate-limited-medium` | The connection [Connection Name] has reached its rate limit. This article will be delivered once the limit resets. |
| `would-deliver-passing-comparison` | This article was seen before, but a monitored field changed (like the title or description), so it will be re-delivered as an update. |

## Delivery Checks View (Level 3)

For power users who need to see exactly what happened at each stage of the delivery process.

**Trigger:** "View Delivery Checks" text link in expanded row details (opens modal)

### Modal Overview

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
│ > ✓  ID Comparison         Article ID is new                    │
│                                                                 │
│ v ✗  Blocking Comparison   description field unchanged          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Configured Fields     description, content                  │ │
│ │ Active Fields         description                           │ │
│ │ Blocked By            description (no change detected)      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│   —  Passing Comparison    Skipped (earlier check failed)       │
│                                                                 │
│   —  Date Check            Skipped                              │
│                                                                 │
│   —  Medium Filter         Skipped                              │
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

**Collapsed Row:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [>] [Icon] Stage Name         Brief summary text                │
└─────────────────────────────────────────────────────────────────┘
```

- `[>]` = Chevron (clickable to expand)
- `[Icon]` = Status icon (✓ green / ✗ red / — gray)
- Stage Name = Human-readable stage name
- Brief summary = One-line explanation

**Expanded Row (Passed):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [v] ✓  Feed State            Not first run                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Has Prior Articles    Yes                                   │ │
│ │ Is First Run          No                                    │ │
│ │ Stored Comparisons    title, description                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded Row (Failed - Auto-expanded by default):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [v] ✗  Blocking Comparison   description field unchanged        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Configured Fields     description, content                  │ │
│ │ Active Fields         description                           │ │
│ │ Blocked By            description (no change detected)      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Skipped Row (Not expandable):**
```
┌─────────────────────────────────────────────────────────────────┐
│     —  Passing Comparison    Skipped (earlier check failed)     │
└─────────────────────────────────────────────────────────────────┘
```

- No chevron (nothing to expand)
- Gray dash icon
- Gray/muted text
- Brief explanation of why skipped

### Stage-Specific Expanded Details

**Feed State (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Has Prior Articles    Yes                             │
│ Is First Run          No                              │
│ Stored Comparisons    title, description, content     │
└───────────────────────────────────────────────────────┘
```

**ID Comparison (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Article ID Hash       a1b2c3d4e5f6...                 │
│ Found in Hot Cache    No                              │
│ Found in Cold Cache   No                              │
│ Is New                Yes                             │
└───────────────────────────────────────────────────────┘
```

**Blocking Comparison (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Configured Fields     description, content            │
│ Active Fields         description                     │
│ Blocked By            description (no change)         │
└───────────────────────────────────────────────────────┘
```

**Passing Comparison (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Configured Fields     title, author                   │
│ Active Fields         title                           │
│ Changed Fields        title (triggered re-delivery)   │
└───────────────────────────────────────────────────────┘
```

**Date Check (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Article Date          2024-01-15 10:30:00 UTC         │
│ Age                   2 days, 4 hours                 │
│ Threshold             7 days                          │
│ Within Threshold      Yes                             │
└───────────────────────────────────────────────────────┘
```

**Medium Filter (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Connection            #announcements                  │
│ Filter Result         Blocked                         │
│ Blocked Because:                                      │
│   • title must contain "urgent"                       │
│   • category must not equal "sports"                  │
└───────────────────────────────────────────────────────┘
```

**Feed Rate Limit (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Current Count         47 articles                     │
│ Daily Limit           50 articles                     │
│ Remaining             3 articles                      │
│ Would Exceed          No                              │
└───────────────────────────────────────────────────────┘
```

**Connection Rate Limit (Passed/Failed):**
```
┌───────────────────────────────────────────────────────┐
│ Connection            #announcements                  │
│ Current Count         10 articles                     │
│ Limit                 10 per hour                     │
│ Time Window           1 hour                          │
│ Remaining             0 articles                      │
│ Would Exceed          Yes                             │
└───────────────────────────────────────────────────────┘
```

### Visual Design Specifications

**Status Icons:**
| Status  | Icon | Color | Background |
|---------|------|-------|------------|
| Passed  | ✓ (check) | green.500 | green.50 |
| Failed  | ✗ (x-mark) | red.500 | red.50 |
| Skipped | — (dash) | gray.400 | none |

**Row Styling:**
- Passed rows: Default background, subtle left border (green.200)
- Failed rows: Light red background (red.50), left border (red.400)
- Skipped rows: Muted text (gray.500), no background, no border

**Detail Panel:**
- Background: gray.50 (light mode) / gray.700 (dark mode)
- Border radius: md (6px)
- Padding: 12px
- Margin: 0 24px 8px 24px (indented from stage row)
- Font: Monospace for hash values, regular for labels

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
│ > ✓  ID Comparison              │
│      Article ID is new          │
│                                 │
│ v ✗  Blocking Comparison        │
│      description unchanged      │
│ ┌─────────────────────────────┐ │
│ │ Configured Fields           │ │
│ │ description, content        │ │
│ │                             │ │
│ │ Active Fields               │ │
│ │ description                 │ │
│ │                             │ │
│ │ Blocked By                  │ │
│ │ description (no change)     │ │
│ └─────────────────────────────┘ │
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
- All connections blocked for same reason -> Show that reason (e.g., "First Run")
- Mixed results -> "Partial" (yellow/orange)
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
- Updates "Last checked" timestamp on completion
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
| Status: First Run             |
---------------------------------
| "Tech Update: New Phone..."   |
| Status: First Run             |
---------------------------------
```

### Expanded Details on Mobile

- Full width, stacked layout
- Connection table becomes list:

```
Connections:

#announcements
  Would deliver after first run

#tech-news
  Blocked by filters
  -> title contains "update"

@news-webhook
  Rate limited (5/5 today)
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
