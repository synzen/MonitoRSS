import {
  ArticleDeliveryOutcome,
  DeliveryPreviewStage,
  DeliveryPreviewStageStatus,
  BackendArticleDeliveryResult,
  BackendMediumDeliveryResult,
} from "../../features/feed/types/DeliveryPreview";

/**
 * Mock state configuration for Article Diagnostics testing.
 * Change this value to test different UI states:
 * - 'normal': Shows mixed outcomes (default)
 * - 'empty': Returns no articles (tests empty feed state)
 * - 'no-connections': Articles exist but no active connections (empty mediumResults)
 * - 'all-learning': All articles show "Learning Feed" (triggers pattern alert)
 * - 'all-rate-limited': All articles show "Daily Limit Reached" (triggers pattern alert)
 * - 'all-duplicate': All articles show "Previously Seen" (triggers pattern alert)
 * - 'all-feed-unchanged': All articles show "No Changes" (triggers pattern alert for unchanged feed)
 * - 'all-feed-error': All articles show "Feed Error" (triggers pattern alert for feed errors)
 * - 'feed-error-403': Feed fetch error with HTTP 403 status code (access denied)
 * - 'feed-error-404': Feed fetch error with HTTP 404 status code (not found)
 * - 'feed-error-503': Feed fetch error with HTTP 503 status code (service unavailable)
 */
type MockDiagnosticsState =
  | "normal"
  | "empty"
  | "no-connections"
  | "all-learning"
  | "all-rate-limited"
  | "all-duplicate"
  | "all-feed-unchanged"
  | "all-feed-error"
  | "feed-error-403"
  | "feed-error-404"
  | "feed-error-503";
export const MOCK_DIAGNOSTICS_STATE: MockDiagnosticsState = "feed-error-403";

export interface MockFeedState {
  state: string;
  errorType?: string;
  httpStatusCode?: number;
}

export const getMockFeedState = (): MockFeedState | undefined => {
  switch (MOCK_DIAGNOSTICS_STATE as MockDiagnosticsState) {
    case "feed-error-403":
      return {
        state: "fetch-error",
        errorType: "bad-status-code",
        httpStatusCode: 403,
      };
    case "feed-error-404":
      return {
        state: "fetch-error",
        errorType: "bad-status-code",
        httpStatusCode: 404,
      };
    case "feed-error-503":
      return {
        state: "fetch-error",
        errorType: "bad-status-code",
        httpStatusCode: 503,
      };
    case "all-feed-error":
      return {
        state: "fetch-error",
        errorType: "timeout",
      };
    // Note: "all-feed-unchanged" no longer returns a feed-level state.
    // When the feed is unchanged, the backend returns articles with FeedUnchanged outcome.
    default:
      return undefined;
  }
};

/**
 * Backend format stages use { stage, status, details } - no summary.
 * The frontend transformation adds summary strings.
 * Backend returns complete stage list including skipped stages.
 */
export const createPassedStages = (mediumId: string) => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleIdHash: "a1b2c3d4e5f6",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 3600000,
      withinThreshold: true,
    },
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      currentCount: 5,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 45,
      wouldExceed: false,
    },
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      mediumId,
      filterExpression: null,
      filterResult: true,
      explainBlocked: [],
    },
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      currentCount: 2,
      limit: 10,
      timeWindowSeconds: 3600,
      remaining: 8,
      wouldExceed: false,
    },
  },
];

export const createFirstRunStages = () => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Failed,
    details: {
      hasPriorArticles: false,
      isFirstRun: true,
      storedComparisonNames: [],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
];

export const createFilteredStages = (mediumId: string) => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleIdHash: "f6e5d4c3b2a1",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 7200000,
      withinThreshold: true,
    },
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      currentCount: 5,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 45,
      wouldExceed: false,
    },
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Failed,
    details: {
      mediumId,
      filterExpression: { type: "logical", op: "and" },
      filterResult: false,
      explainBlocked: ['title must contain "urgent"', 'category must not equal "sports"'],
    },
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
];

export const createDuplicateIdStages = () => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Failed,
    details: {
      articleIdHash: "duplicate123",
      foundInHotPartition: true,
      foundInColdPartition: false,
      isNew: false,
    },
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
];

export const createRateLimitedStages = (_mediumId: string) => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleIdHash: "newart789",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 1800000,
      withinThreshold: true,
    },
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Failed,
    details: {
      currentCount: 50,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 0,
      wouldExceed: true,
    },
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
];

export const createBlockedByComparisonStages = (_mediumId: string) => [
  {
    stage: DeliveryPreviewStage.FeedState,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description", "content"],
    },
  },
  {
    stage: DeliveryPreviewStage.IdComparison,
    status: DeliveryPreviewStageStatus.Passed,
    details: {
      articleIdHash: "comp456",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DeliveryPreviewStage.BlockingComparison,
    status: DeliveryPreviewStageStatus.Failed,
    details: {
      comparisonFields: ["description", "content"],
      activeFields: ["description"],
      blockedByFields: ["description"],
    },
  },
  {
    stage: DeliveryPreviewStage.PassingComparison,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.DateCheck,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.FeedRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumFilter,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
  {
    stage: DeliveryPreviewStage.MediumRateLimit,
    status: DeliveryPreviewStageStatus.Skipped,
    details: null,
  },
];

export const mockDeliveryPreviews: BackendArticleDeliveryResult[] = [
  {
    articleId: "art-001",
    articleIdHash: "hash001",
    articleTitle: "Breaking News: Major Market Rally Pushes Stocks to Record Highs",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-002",
    articleIdHash: "hash002",
    articleTitle: "Tech Update: New Smartphone Features Revolutionary Battery Technology",
    outcome: ArticleDeliveryOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel with old content.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
    ],
  },
  {
    articleId: "art-003",
    articleIdHash: "hash003",
    articleTitle: "Sports: Championship Game Ends in Dramatic Overtime Victory",
    outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
    outcomeReason:
      "This article doesn't match the filter rules for your connection. Review your filter settings.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-004",
    articleIdHash: "hash004",
    articleTitle: "Weather Alert: Severe Storm Warning Issued for Metropolitan Area",
    outcome: ArticleDeliveryOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
    ],
  },
  {
    articleId: "art-005",
    articleIdHash: "hash005",
    articleTitle: "Politics: New Policy Announcement Sparks Debate Among Lawmakers",
    outcome: ArticleDeliveryOutcome.RateLimitedFeed,
    outcomeReason:
      "Your feed has hit its daily article limit (50/50). Wait until tomorrow for more articles.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-006",
    articleIdHash: "hash006",
    articleTitle: "Science: Researchers Discover New Species in Deep Ocean Expedition",
    outcome: ArticleDeliveryOutcome.BlockedByComparison,
    outcomeReason:
      "This article hasn't changed since it was last checked. The monitored fields are identical to the previous version.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1a"),
      },
    ],
  },
  {
    articleId: "art-007",
    articleIdHash: "hash007",
    articleTitle: "Entertainment: Award-Winning Film Breaks Box Office Records",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-008",
    articleIdHash: "hash008",
    articleTitle: "Health: New Study Reveals Benefits of Mediterranean Diet",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-009",
    articleIdHash: "hash009",
    articleTitle: "Travel: Hidden Gems of Southeast Asia You Need to Visit",
    outcome: ArticleDeliveryOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
    ],
  },
  {
    articleId: "art-010",
    articleIdHash: "hash010",
    articleTitle: "Business: Startup Secures Record Funding for AI Innovation",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-011",
    articleIdHash: "hash011",
    articleTitle: "Education: Universities Embrace Hybrid Learning Models",
    outcome: ArticleDeliveryOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
    ],
  },
  {
    articleId: "art-012",
    articleIdHash: "hash012",
    articleTitle: "Food: Master Chef Shares Secret Recipe for Perfect Pasta",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-013",
    articleIdHash: "hash013",
    articleTitle: "Gaming: Highly Anticipated RPG Release Date Announced",
    outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
    outcomeReason: "This article doesn't match the filter rules for your connection.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-014",
    articleIdHash: "hash014",
    articleTitle: "Music: Legendary Band Announces Reunion World Tour",
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-015",
    articleIdHash: "hash015",
    articleTitle: "Automotive: Electric Vehicle Sales Surge Past Expectations",
    outcome: ArticleDeliveryOutcome.BlockedByComparison,
    outcomeReason: "This article hasn't changed since it was last checked.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDeliveryOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDeliveryOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1a"),
      },
    ],
  },
];

const createAllLearningMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDeliveryResult => ({
        ...m,
        outcome: ArticleDeliveryOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      })
    ),
  }));

const createAllRateLimitedMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.RateLimitedFeed,
    outcomeReason:
      "Your feed has hit its daily article limit (50/50). Wait until tomorrow for more articles.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDeliveryResult => ({
        ...m,
        outcome: ArticleDeliveryOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages(m.mediumId),
      })
    ),
  }));

const createAllDuplicateMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDeliveryResult => ({
        ...m,
        outcome: ArticleDeliveryOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      })
    ),
  }));

const createNoConnectionsMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.WouldDeliver,
    outcomeReason: "No active connections to deliver to.",
    mediumResults: [],
  }));

const createAllFeedUnchangedMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.FeedUnchanged,
    outcomeReason:
      "Feed content unchanged since last check. Articles will be processed when new content is detected.",
    mediumResults: [],
  }));

const createAllFeedErrorMockData = (): BackendArticleDeliveryResult[] =>
  mockDeliveryPreviews.map((article) => ({
    ...article,
    outcome: ArticleDeliveryOutcome.FeedError,
    outcomeReason: "Feed fetch error (timeout): Request timed out after 30 seconds",
    mediumResults: [],
  }));

export const getMockDeliveryPreviews = (): BackendArticleDeliveryResult[] => {
  switch (MOCK_DIAGNOSTICS_STATE as MockDiagnosticsState) {
    case "empty":
      return [];
    case "no-connections":
      return createNoConnectionsMockData();
    case "all-learning":
      return createAllLearningMockData();
    case "all-rate-limited":
      return createAllRateLimitedMockData();
    case "all-duplicate":
      return createAllDuplicateMockData();
    case "all-feed-unchanged":
      return createAllFeedUnchangedMockData();
    case "all-feed-error":
      return createAllFeedErrorMockData();
    default:
      return mockDeliveryPreviews;
  }
};
