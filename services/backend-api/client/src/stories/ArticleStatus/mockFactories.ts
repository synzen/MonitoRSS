import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
  DiagnosticStage,
  DiagnosticStageResult,
  DiagnosticStageStatus,
  MediumDiagnosticResult,
} from "../../features/feed/types/ArticleDiagnostics";
import { FeedState } from "../../features/feed/components/UserFeedLogs/ArticleStatus/FeedLevelStateDisplay";

// Mock connection data
export const mockConnections = [
  { id: "conn-1", name: "General Announcements", key: "discordChannels", disabledCode: null },
  { id: "conn-2", name: "News Updates", key: "discordChannels", disabledCode: null },
  { id: "conn-3", name: "Tech Feed", key: "discordChannels", disabledCode: null },
];

// Mock user feed data
export const mockUserFeed = {
  id: "feed-123",
  title: "Example RSS Feed",
  url: "https://example.com/feed.xml",
  refreshRateSeconds: 600,
  connections: mockConnections,
};

// ============================================================================
// Feed State Factories (for FeedLevelStateDisplay)
// ============================================================================

export const createFeedState404 = (): FeedState => ({
  state: "fetch-error",
  errorType: "bad-status-code",
  httpStatusCode: 404,
});

export const createFeedState403 = (): FeedState => ({
  state: "fetch-error",
  errorType: "bad-status-code",
  httpStatusCode: 403,
});

export const createFeedState429 = (): FeedState => ({
  state: "fetch-error",
  errorType: "bad-status-code",
  httpStatusCode: 429,
});

export const createFeedState5xx = (): FeedState => ({
  state: "fetch-error",
  errorType: "bad-status-code",
  httpStatusCode: 503,
});

export const createFetchTimeout = (): FeedState => ({
  state: "fetch-error",
  errorType: "timeout",
});

export const createFetchFailed = (): FeedState => ({
  state: "fetch-error",
  errorType: "fetch",
});

export const createFetchInternalError = (): FeedState => ({
  state: "fetch-error",
  errorType: "internal",
});

export const createParseTimeout = (): FeedState => ({
  state: "parse-error",
  errorType: "timeout",
});

export const createParseInvalidFormat = (): FeedState => ({
  state: "parse-error",
  errorType: "invalid",
});

// ============================================================================
// Frontend-format Stage Factories (for Storybook - with status and summary)
// ============================================================================

const createPassedStages = (mediumId: string): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    summary: "Feed is ready",
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    summary: "New article",
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
    summary: "Not configured",
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Not configured",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    summary: "Article is recent",
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 3600000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Passed,
    summary: "Matches your filters",
    details: {
      mediumId,
      filterExpression: null,
      filterResult: true,
      explainBlocked: [],
      explainMatched: [],
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Passed,
    summary: "5 of 50 today",
    details: {
      currentCount: 5,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 45,
      wouldExceed: false,
    },
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Passed,
    summary: "2 of 10 this hour",
    details: {
      currentCount: 2,
      limit: 10,
      timeWindowSeconds: 3600,
      remaining: 8,
      wouldExceed: false,
    },
  },
];

const createFirstRunStages = (): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Failed,
    summary: "Recording existing articles",
    details: {
      hasPriorArticles: false,
      isFirstRun: true,
      storedComparisonNames: [],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.BlockingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped during initial scan",
    details: null,
  },
];

const createFilteredStages = (mediumId: string): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    summary: "Feed is ready",
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    summary: "New article",
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
    summary: "Not configured",
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Not configured",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    summary: "Article is recent",
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 7200000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Failed,
    summary: "Doesn't match filters",
    details: {
      mediumId,
      filterExpression: { type: "logical", op: "and" },
      filterResult: false,
      explainBlocked: [
        {
          message: 'title must contain "urgent"',
          truncatedReferenceValue: "Breaking News: Market Update for Today",
          filterInput: "urgent",
          fieldName: "title",
          operator: "CONTAINS",
          isNegated: false,
        },
        {
          message: 'category must not equal "sports"',
          truncatedReferenceValue: "sports",
          filterInput: "sports",
          fieldName: "category",
          operator: "EQ",
          isNegated: true,
        },
      ],
      explainMatched: [],
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
];

const createDuplicateIdStages = (): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    summary: "Feed is ready",
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Failed,
    summary: "Already processed",
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
    summary: "Skipped - already processed",
    details: null,
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - already processed",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - already processed",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - already processed",
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - already processed",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - already processed",
    details: null,
  },
];

const createRateLimitedStages = (mediumId: string): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    summary: "Feed is ready",
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    summary: "New article",
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
    summary: "Not configured",
    details: {
      comparisonFields: [],
      activeFields: [],
      blockedByFields: [],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Not configured",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Passed,
    summary: "Article is recent",
    details: {
      articleDate: new Date().toISOString(),
      threshold: 604800000,
      datePlaceholders: ["pubdate"],
      ageMs: 1800000,
      withinThreshold: true,
    },
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Passed,
    summary: "Matches your filters",
    details: {
      mediumId,
      filterExpression: null,
      filterResult: true,
      explainBlocked: [],
      explainMatched: [],
    },
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Failed,
    summary: "Limit reached (50/50)",
    details: {
      currentCount: 50,
      limit: 50,
      timeWindowSeconds: 86400,
      remaining: 0,
      wouldExceed: true,
    },
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
];

const createBlockedByComparisonStages = (_mediumId: string): DiagnosticStageResult[] => [
  {
    stage: DiagnosticStage.FeedState,
    status: DiagnosticStageStatus.Passed,
    summary: "Feed is ready",
    details: {
      hasPriorArticles: true,
      isFirstRun: false,
      storedComparisonNames: ["title", "description", "content"],
    },
  },
  {
    stage: DiagnosticStage.IdComparison,
    status: DiagnosticStageStatus.Passed,
    summary: "New article",
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
    summary: "No changes in description",
    details: {
      comparisonFields: ["description", "content"],
      activeFields: ["description"],
      blockedByFields: ["description"],
    },
  },
  {
    stage: DiagnosticStage.PassingComparison,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
  {
    stage: DiagnosticStage.DateCheck,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumFilter,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
  {
    stage: DiagnosticStage.FeedRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
  {
    stage: DiagnosticStage.MediumRateLimit,
    status: DiagnosticStageStatus.Skipped,
    summary: "Skipped - blocked above",
    details: null,
  },
];

// ============================================================================
// Medium Result Factories
// ============================================================================

export const createMediumResult = (
  outcome: ArticleDiagnosisOutcome,
  mediumId = "conn-1"
): MediumDiagnosticResult => {
  const getStages = (): DiagnosticStageResult[] => {
    switch (outcome) {
      case ArticleDiagnosisOutcome.WouldDeliver:
      case ArticleDiagnosisOutcome.WouldDeliverPassingComparison:
        return createPassedStages(mediumId);
      case ArticleDiagnosisOutcome.FirstRunBaseline:
        return createFirstRunStages();
      case ArticleDiagnosisOutcome.FilteredByMediumFilter:
        return createFilteredStages(mediumId);
      case ArticleDiagnosisOutcome.DuplicateId:
        return createDuplicateIdStages();
      case ArticleDiagnosisOutcome.RateLimitedFeed:
      case ArticleDiagnosisOutcome.RateLimitedMedium:
        return createRateLimitedStages(mediumId);
      case ArticleDiagnosisOutcome.BlockedByComparison:
        return createBlockedByComparisonStages(mediumId);
      default:
        return createPassedStages(mediumId);
    }
  };

  const getOutcomeReason = () => {
    switch (outcome) {
      case ArticleDiagnosisOutcome.WouldDeliver:
        return "Would be delivered";
      case ArticleDiagnosisOutcome.FirstRunBaseline:
        return "First run - establishing baseline";
      case ArticleDiagnosisOutcome.FilteredByMediumFilter:
        return "Blocked by filters";
      case ArticleDiagnosisOutcome.DuplicateId:
        return "Previously seen";
      case ArticleDiagnosisOutcome.RateLimitedFeed:
        return "Daily limit reached";
      case ArticleDiagnosisOutcome.RateLimitedMedium:
        return "Connection limit reached";
      case ArticleDiagnosisOutcome.BlockedByComparison:
        return "No changes detected";
      default:
        return "";
    }
  };

  return {
    mediumId,
    outcome,
    outcomeReason: getOutcomeReason(),
    stages: getStages(),
  };
};

// ============================================================================
// Article Result Factories
// ============================================================================

export const createArticleResult = (
  outcome: ArticleDiagnosisOutcome,
  options: {
    articleId?: string;
    articleTitle?: string;
    connectionIds?: string[];
    mixedOutcomes?: ArticleDiagnosisOutcome[];
  } = {}
): ArticleDiagnosticResult => {
  const {
    articleId = "art-001",
    articleTitle = "Breaking News: Major Market Rally Pushes Stocks to Record Highs",
    connectionIds = ["conn-1"],
    mixedOutcomes,
  } = options;

  const getOutcomeReason = () => {
    switch (outcome) {
      case ArticleDiagnosisOutcome.WouldDeliver:
        return "This article will be delivered to Discord when your feed is next processed.";
      case ArticleDiagnosisOutcome.FirstRunBaseline:
        return "This is a new feed. Articles are being recorded but not delivered yet.";
      case ArticleDiagnosisOutcome.FilteredByMediumFilter:
        return "This article doesn't match the filter rules for your connection.";
      case ArticleDiagnosisOutcome.DuplicateId:
        return "MonitoRSS has already seen this article.";
      case ArticleDiagnosisOutcome.RateLimitedFeed:
        return "Your feed has hit its daily article limit.";
      case ArticleDiagnosisOutcome.FeedUnchanged:
        return "Feed content unchanged since last check.";
      case ArticleDiagnosisOutcome.FeedError:
        return "Feed fetch error (timeout): Request timed out after 30 seconds";
      case ArticleDiagnosisOutcome.MixedResults:
        return "This article would deliver to some connections but not others.";
      default:
        return "";
    }
  };

  let mediumResults: MediumDiagnosticResult[];

  if (mixedOutcomes && mixedOutcomes.length > 0) {
    mediumResults = mixedOutcomes.map((o, i) =>
      createMediumResult(o, connectionIds[i] || `conn-${i + 1}`)
    );
  } else {
    mediumResults = connectionIds.map((id) => createMediumResult(outcome, id));
  }

  return {
    articleId,
    articleIdHash: `hash-${articleId}`,
    articleTitle,
    outcome,
    outcomeReason: getOutcomeReason(),
    mediumResults,
  };
};

// ============================================================================
// Scenario Factories (Complete data sets for stories)
// ============================================================================

export const createWouldDeliverArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.WouldDeliver, {
    articleTitle: "Tech Update: New Smartphone Features Revolutionary Battery Technology",
    connectionIds: ["conn-1", "conn-2"],
  });

export const createLearningArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.FirstRunBaseline, {
    articleTitle: "Entertainment: Award-Winning Film Breaks Box Office Records",
    connectionIds: ["conn-1"],
  });

export const createFilteredByDateArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.FilteredByDateCheck, {
    articleTitle: "Archive: Historical Article From Last Year",
    connectionIds: ["conn-1"],
  });

export const createBlockedByFiltersArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.FilteredByMediumFilter, {
    articleTitle: "Sports: Championship Game Ends in Dramatic Overtime Victory",
    connectionIds: ["conn-1", "conn-2"],
  });

export const createRateLimitedArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.RateLimitedFeed, {
    articleTitle: "Politics: New Policy Announcement Sparks Debate Among Lawmakers",
    connectionIds: ["conn-1"],
  });

export const createMixedResultsArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.MixedResults, {
    articleTitle: "Health: New Study Reveals Benefits of Mediterranean Diet",
    connectionIds: ["conn-1", "conn-2", "conn-3"],
    mixedOutcomes: [
      ArticleDiagnosisOutcome.WouldDeliver,
      ArticleDiagnosisOutcome.FilteredByMediumFilter,
      ArticleDiagnosisOutcome.RateLimitedMedium,
    ],
  });

export const createDeletedConnectionArticle = () => {
  const result = createArticleResult(ArticleDiagnosisOutcome.WouldDeliver, {
    articleTitle: "Science: Researchers Discover New Species in Deep Ocean",
    connectionIds: ["deleted-conn-xyz"],
  });
  return result;
};

export const createMultipleConnectionsArticle = () =>
  createArticleResult(ArticleDiagnosisOutcome.WouldDeliver, {
    articleTitle: "Business: Startup Secures Record Funding for AI Innovation",
    connectionIds: ["conn-1", "conn-2", "conn-3"],
  });

// ============================================================================
// Bulk Article Factories (for main container stories)
// ============================================================================

export const createNormalDeliveryArticles = (): ArticleDiagnosticResult[] => [
  createWouldDeliverArticle(),
  createArticleResult(ArticleDiagnosisOutcome.DuplicateId, {
    articleId: "art-002",
    articleTitle: "Weather Alert: Severe Storm Warning Issued for Metropolitan Area",
    connectionIds: ["conn-1"],
  }),
  createArticleResult(ArticleDiagnosisOutcome.WouldDeliver, {
    articleId: "art-003",
    articleTitle: "Food: Master Chef Shares Secret Recipe for Perfect Pasta",
    connectionIds: ["conn-1", "conn-2"],
  }),
  createArticleResult(ArticleDiagnosisOutcome.FilteredByMediumFilter, {
    articleId: "art-004",
    articleTitle: "Gaming: Highly Anticipated RPG Release Date Announced",
    connectionIds: ["conn-1"],
  }),
  createArticleResult(ArticleDiagnosisOutcome.WouldDeliver, {
    articleId: "art-005",
    articleTitle: "Music: Legendary Band Announces Reunion World Tour",
    connectionIds: ["conn-1"],
  }),
];

export const createLearningPhaseArticles = (): ArticleDiagnosticResult[] =>
  Array.from({ length: 10 }, (_, i) =>
    createArticleResult(ArticleDiagnosisOutcome.FirstRunBaseline, {
      articleId: `art-${i + 1}`,
      articleTitle: `Learning Phase Article ${i + 1}: Sample Content`,
      connectionIds: ["conn-1", "conn-2"],
    })
  );

export const createRateLimitedArticles = (): ArticleDiagnosticResult[] =>
  Array.from({ length: 10 }, (_, i) =>
    createArticleResult(ArticleDiagnosisOutcome.RateLimitedFeed, {
      articleId: `art-${i + 1}`,
      articleTitle: `Rate Limited Article ${i + 1}: Daily Limit Reached`,
      connectionIds: ["conn-1"],
    })
  );

export const createAllProcessedArticles = (): ArticleDiagnosticResult[] =>
  Array.from({ length: 10 }, (_, i) =>
    createArticleResult(ArticleDiagnosisOutcome.DuplicateId, {
      articleId: `art-${i + 1}`,
      articleTitle: `Previously Seen Article ${i + 1}: Already Delivered`,
      connectionIds: ["conn-1"],
    })
  );

export const createFeedUnchangedArticles = (): ArticleDiagnosticResult[] =>
  Array.from({ length: 5 }, (_, i) =>
    createArticleResult(ArticleDiagnosisOutcome.FeedUnchanged, {
      articleId: `art-${i + 1}`,
      articleTitle: `Unchanged Article ${i + 1}`,
      connectionIds: [],
    })
  );
