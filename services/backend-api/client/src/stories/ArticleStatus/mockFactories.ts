import {
  ArticleDiagnosisOutcome,
  ArticleDiagnosticResult,
  MediumDiagnosticResult,
} from "../../features/feed/types/ArticleDiagnostics";
import {
  createPassedStages,
  createFirstRunStages,
  createFilteredStages,
  createDuplicateIdStages,
  createRateLimitedStages,
  createBlockedByComparisonStages,
} from "../../mocks/data/articleDiagnostics";
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
// Medium Result Factories
// ============================================================================

export const createMediumResult = (
  outcome: ArticleDiagnosisOutcome,
  mediumId = "conn-1"
): MediumDiagnosticResult => {
  const getStages = () => {
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
