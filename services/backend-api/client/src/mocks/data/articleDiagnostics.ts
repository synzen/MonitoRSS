import {
  ArticleDiagnosisOutcome,
  DiagnosticStage,
  DiagnosticStageStatus,
  BackendArticleDiagnosticResult,
  BackendMediumDiagnosticResult,
} from "../../features/feed/types/ArticleDiagnostics";

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
export const MOCK_DIAGNOSTICS_STATE: MockDiagnosticsState = "normal";

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
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleIdHash: "a1b2c3d4e5f6",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 3600000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Passed,
    details: {
      currentCount: 5,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 45,
      wouldExceed: false,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Passed,
    details: {
      mediumId,
      filterExpression: null,
      filterResult: true,
      explainBlocked: [],
    },
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Passed,
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
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Failed,
    details: {
      hasPriorArticles: false,
      isFirstRun: true,
      storedComparisonNames: [],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
];

export const createFilteredStages = (mediumId: string) => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleIdHash: "f6e5d4c3b2a1",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 7200000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Passed,
    details: {
      currentCount: 5,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 45,
      wouldExceed: false,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Failed,
    details: {
      mediumId,
      filterExpression: { type: "logical", op: "and" },
      filterResult: false,
      explainBlocked: ['title must contain "urgent"', 'category must not equal "sports"'],
    },
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
];

export const createDuplicateIdStages = () => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Failed,
    details: {
      articleIdHash: "duplicate123",
      foundInHotPartition: true,
      foundInColdPartition: false,
      isNew: false,
    },
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
];

export const createRateLimitedStages = (_mediumId: string) => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleIdHash: "newart789",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 1800000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Failed,
    details: {
      currentCount: 50,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 0,
      wouldExceed: true,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
];

export const createBlockedByComparisonStages = (_mediumId: string) => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description", "content"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    details: {
      articleIdHash: "comp456",
      foundInHotPartition: false,
      foundInColdPartition: false,
      isNew: true,
    },
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Failed,
    details: {
      comparisonFields: ["description", "content"],
      activeFields: ["description"],
      blockedByFields: ["description"],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    details: null,
  },
];

export const mockArticleDiagnostics: BackendArticleDiagnosticResult[] = [
  {
    articleId: "art-001",
    articleIdHash: "hash001",
    articleTitle: "Breaking News: Major Market Rally Pushes Stocks to Record Highs",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-002",
    articleIdHash: "hash002",
    articleTitle: "Tech Update: New Smartphone Features Revolutionary Battery Technology",
    outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel with old content.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
    ],
  },
  {
    articleId: "art-003",
    articleIdHash: "hash003",
    articleTitle: "Sports: Championship Game Ends in Dramatic Overtime Victory",
    outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
    outcomeReason:
      "This article doesn't match the filter rules for your connection. Review your filter settings.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-004",
    articleIdHash: "hash004",
    articleTitle: "Weather Alert: Severe Storm Warning Issued for Metropolitan Area",
    outcome: ArticleDiagnosisOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
    ],
  },
  {
    articleId: "art-005",
    articleIdHash: "hash005",
    articleTitle: "Politics: New Policy Announcement Sparks Debate Among Lawmakers",
    outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
    outcomeReason:
      "Your feed has hit its daily article limit (50/50). Wait until tomorrow for more articles.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-006",
    articleIdHash: "hash006",
    articleTitle: "Science: Researchers Discover New Species in Deep Ocean Expedition",
    outcome: ArticleDiagnosisOutcome.BlockedByComparison,
    outcomeReason:
      "This article hasn't changed since it was last checked. The monitored fields are identical to the previous version.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1a"),
      },
    ],
  },
  {
    articleId: "art-007",
    articleIdHash: "hash007",
    articleTitle: "Entertainment: Award-Winning Film Breaks Box Office Records",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-008",
    articleIdHash: "hash008",
    articleTitle: "Health: New Study Reveals Benefits of Mediterranean Diet",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-009",
    articleIdHash: "hash009",
    articleTitle: "Travel: Hidden Gems of Southeast Asia You Need to Visit",
    outcome: ArticleDiagnosisOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      },
    ],
  },
  {
    articleId: "art-010",
    articleIdHash: "hash010",
    articleTitle: "Business: Startup Secures Record Funding for AI Innovation",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-011",
    articleIdHash: "hash011",
    articleTitle: "Education: Universities Embrace Hybrid Learning Models",
    outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      },
    ],
  },
  {
    articleId: "art-012",
    articleIdHash: "hash012",
    articleTitle: "Food: Master Chef Shares Secret Recipe for Perfect Pasta",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-013",
    articleIdHash: "hash013",
    articleTitle: "Gaming: Highly Anticipated RPG Release Date Announced",
    outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
    outcomeReason: "This article doesn't match the filter rules for your connection.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
        outcomeReason: "Blocked by filters",
        stages: createFilteredStages("1a"),
      },
    ],
  },
  {
    articleId: "art-014",
    articleIdHash: "hash014",
    articleTitle: "Music: Legendary Band Announces Reunion World Tour",
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "This article will be delivered to Discord when your feed is next processed.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.WouldDeliver,
        outcomeReason: "Would be delivered",
        stages: createPassedStages("1a"),
      },
    ],
  },
  {
    articleId: "art-015",
    articleIdHash: "hash015",
    articleTitle: "Automotive: Electric Vehicle Sales Surge Past Expectations",
    outcome: ArticleDiagnosisOutcome.BlockedByComparison,
    outcomeReason: "This article hasn't changed since it was last checked.",
    mediumResults: [
      {
        mediumId: "1",
        outcome: ArticleDiagnosisOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1"),
      },
      {
        mediumId: "1a",
        outcome: ArticleDiagnosisOutcome.BlockedByComparison,
        outcomeReason: "No changes detected",
        stages: createBlockedByComparisonStages("1a"),
      },
    ],
  },
];

const createAllLearningMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
    outcomeReason:
      "This is a new feed. Articles are being recorded but not delivered yet to prevent flooding your channel.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDiagnosticResult => ({
        ...m,
        outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
        outcomeReason: "First run - establishing baseline",
        stages: createFirstRunStages(),
      })
    ),
  }));

const createAllRateLimitedMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
    outcomeReason:
      "Your feed has hit its daily article limit (50/50). Wait until tomorrow for more articles.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDiagnosticResult => ({
        ...m,
        outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
        outcomeReason: "Daily limit reached",
        stages: createRateLimitedStages(m.mediumId),
      })
    ),
  }));

const createAllDuplicateMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.DuplicateId,
    outcomeReason:
      "MonitoRSS has already seen this article. It may have been delivered previously, or recorded when the feed was first added.",
    mediumResults: article.mediumResults.map(
      (m): BackendMediumDiagnosticResult => ({
        ...m,
        outcome: ArticleDiagnosisOutcome.DuplicateId,
        outcomeReason: "Previously seen",
        stages: createDuplicateIdStages(),
      })
    ),
  }));

const createNoConnectionsMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "No active connections to deliver to.",
    mediumResults: [],
  }));

const createAllFeedUnchangedMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.FeedUnchanged,
    outcomeReason:
      "Feed content unchanged since last check. Articles will be processed when new content is detected.",
    mediumResults: [],
  }));

const createAllFeedErrorMockData = (): BackendArticleDiagnosticResult[] =>
  mockArticleDiagnostics.map((article) => ({
    ...article,
    outcome: ArticleDiagnosisOutcome.FeedError,
    outcomeReason: "Feed fetch error (timeout): Request timed out after 30 seconds",
    mediumResults: [],
  }));

export const getMockDiagnostics = (): BackendArticleDiagnosticResult[] => {
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
      return mockArticleDiagnostics;
  }
};
