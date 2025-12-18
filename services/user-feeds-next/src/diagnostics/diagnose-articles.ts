import type { Article } from "../articles/parser";
import {
  getArticlesToDeliver,
  type ArticleFieldStore,
  type DateCheckOptions,
} from "../articles/comparison";
import type { LogicalExpression } from "../articles/filters";
import {
  deliverArticles,
  createTestDiscordRestClient,
  type DeliveryMedium,
} from "../delivery";
import type { DeliveryRecordStore } from "../stores/interfaces/delivery-record-store";
import {
  startDiagnosticContext,
  getDiagnosticResultsForArticle,
  getAllDiagnosticResults,
} from "./diagnostic-context";
import {
  ArticleDiagnosisOutcome,
  DiagnosticStage,
  type ArticleDiagnosticResult,
  type ArticleDiagnosisSummary,
  type DiagnoseArticlesResponse,
  type DiagnosticStageResult,
  type FeedRateLimitDiagnosticResult,
  type MediumRateLimitDiagnosticResult,
} from "./types";

export interface DiagnoseArticleDependencies {
  articleFieldStore: ArticleFieldStore;
  deliveryRecordStore: DeliveryRecordStore;
}

/**
 * Create a read-only wrapper around an ArticleFieldStore.
 * This prevents diagnostic runs from modifying the database.
 */
function createReadOnlyArticleFieldStore(
  store: ArticleFieldStore
): ArticleFieldStore {
  return {
    ...store,
    storeArticles: async () => {},
    storeComparisonNames: async () => {},
    startContext: async <T>(cb: () => Promise<T>) => cb(),
    flushPendingInserts: async () => ({ affectedRows: 0 }),
  };
}

/**
 * Determine the diagnosis outcome based on recorded diagnostic stages.
 */
function determineOutcome(
  stages: DiagnosticStageResult[]
): { outcome: ArticleDiagnosisOutcome; outcomeReason: string } {
  // Check FeedState for first run
  const feedState = stages.find((s) => s.stage === DiagnosticStage.FeedState);
  if (feedState && "isFirstRun" in feedState.details && feedState.details.isFirstRun) {
    return {
      outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
      outcomeReason: "Feed has no prior articles stored. This is a first-run baseline - all current articles will be stored but not delivered.",
    };
  }

  // Check IdComparison for duplicate
  const idComparison = stages.find(
    (s) => s.stage === DiagnosticStage.IdComparison
  );
  if (idComparison && !idComparison.passed) {
    // Check if there's a passing comparison that allows delivery
    const passingComparison = stages.find(
      (s) => s.stage === DiagnosticStage.PassingComparison
    );
    if (passingComparison?.passed) {
      return {
        outcome: ArticleDiagnosisOutcome.WouldDeliverPassingComparison,
        outcomeReason: "Article ID was already seen, but passes because a comparison field has changed.",
      };
    }

    return {
      outcome: ArticleDiagnosisOutcome.DuplicateId,
      outcomeReason: "Article ID has already been seen and stored. It will not be delivered again.",
    };
  }

  // Check BlockingComparison
  const blockingComparison = stages.find(
    (s) => s.stage === DiagnosticStage.BlockingComparison
  );
  if (blockingComparison && !blockingComparison.passed) {
    const blockedByFields =
      "blockedByFields" in blockingComparison.details
        ? (blockingComparison.details.blockedByFields as string[]).join(", ")
        : "unknown fields";
    return {
      outcome: ArticleDiagnosisOutcome.BlockedByComparison,
      outcomeReason: `Article blocked by comparison field(s): ${blockedByFields}`,
    };
  }

  // Check DateCheck
  const dateCheck = stages.find((s) => s.stage === DiagnosticStage.DateCheck);
  if (dateCheck && !dateCheck.passed) {
    return {
      outcome: ArticleDiagnosisOutcome.FilteredByDateCheck,
      outcomeReason: "Article is older than the configured date threshold and will not be delivered.",
    };
  }

  // Check feed rate limit
  const feedRateLimit = stages.find(
    (s): s is FeedRateLimitDiagnosticResult =>
      s.stage === DiagnosticStage.FeedRateLimit
  );
  if (feedRateLimit && !feedRateLimit.passed) {
    return {
      outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
      outcomeReason: "Feed has reached its daily article delivery limit.",
    };
  }

  // Check medium rate limits
  const exceededMediumRateLimit = stages.find(
    (s): s is MediumRateLimitDiagnosticResult =>
      s.stage === DiagnosticStage.MediumRateLimit && !s.passed
  );
  if (exceededMediumRateLimit) {
    return {
      outcome: ArticleDiagnosisOutcome.RateLimitedMedium,
      outcomeReason: `Medium ${exceededMediumRateLimit.details.mediumId} has reached its rate limit.`,
    };
  }

  // Check medium filters
  const mediumFilter = stages.find(
    (s) => s.stage === DiagnosticStage.MediumFilter
  );
  if (mediumFilter && !mediumFilter.passed) {
    const mediumId =
      "mediumId" in mediumFilter.details
        ? (mediumFilter.details.mediumId as string)
        : "unknown";
    return {
      outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
      outcomeReason: `Article filtered out by medium ${mediumId}'s filter expression.`,
    };
  }

  // Article would be delivered
  return {
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "Article passes all checks and would be delivered to all connections.",
  };
}

export interface DiagnoseArticlesInput {
  feed: {
    id: string;
    blockingComparisons: string[];
    passingComparisons: string[];
    dateChecks?: DateCheckOptions;
  };
  mediums: Array<{
    id: string;
    rateLimits?: Array<{
      limit: number;
      timeWindowSeconds: number;
    }>;
    filters?: {
      expression: LogicalExpression;
    };
  }>;
  articleDayLimit: number;
  /** All articles from the feed (needed for comparison logic) */
  allArticles: Article[];
  /** Target articles to diagnose (paginated subset) */
  targetArticles: Article[];
  summaryOnly?: boolean;
}

/**
 * Diagnose what would happen to multiple articles when processed.
 * This is an optimized batch version that runs getArticlesToDeliver ONCE
 * and captures diagnostics for all target articles in a single pass.
 *
 * @param input.allArticles - All articles from the feed (needed for comparison logic)
 * @param input.targetArticles - The paginated subset of articles to diagnose
 */
export async function diagnoseArticles(
  input: DiagnoseArticlesInput,
  deps: DiagnoseArticleDependencies
): Promise<DiagnoseArticlesResponse> {
  // Handle empty target articles
  if (input.targetArticles.length === 0) {
    return { results: [], errors: [] };
  }

  // Build set of target ID hashes for diagnostic context
  const targetIdHashes = new Set<string>(
    input.targetArticles.map((a) => a.flattened.idHash)
  );

  // Run diagnostic context with ALL target hashes - ONE call to getArticlesToDeliver
  const readOnlyStore = createReadOnlyArticleFieldStore(deps.articleFieldStore);

  // Build results inside the context so we can access diagnostic results
  const results = await startDiagnosticContext(targetIdHashes, async () => {
    // Run comparison logic on ALL articles (will record diagnostics for targets)
    const comparisonResult = await getArticlesToDeliver(
      readOnlyStore,
      input.feed.id,
      input.allArticles,
      {
        blockingComparisons: input.feed.blockingComparisons,
        passingComparisons: input.feed.passingComparisons,
        dateChecks: input.feed.dateChecks,
      }
    );

    // Build delivery mediums with placeholder details (no actual delivery)
    const deliveryMediums: DeliveryMedium[] = input.mediums.map((m) => ({
      id: m.id,
      filters: m.filters,
      rateLimits: m.rateLimits,
      details: {
        guildId: "diagnostic",
        channel: { id: "diagnostic" },
      },
    }));

    // For each target in deliverable, run delivery simulation
    for (const target of input.targetArticles) {
      const targetInDeliverable = comparisonResult.articlesToDeliver.find(
        (a) => a.flattened.idHash === target.flattened.idHash
      );
      if (targetInDeliverable) {
        await deliverArticles([targetInDeliverable], deliveryMediums, {
          feedId: input.feed.id,
          feedUrl: "diagnostic://placeholder",
          articleDayLimit: input.articleDayLimit,
          deliveryRecordStore: deps.deliveryRecordStore,
          discordClient: createTestDiscordRestClient(),
        });
      }
    }

    // Build results inside context to access diagnostic data
    const builtResults: (ArticleDiagnosticResult | ArticleDiagnosisSummary)[] = [];

    for (const article of input.targetArticles) {
      const stages = getDiagnosticResultsForArticle(article.flattened.idHash);
      const { outcome, outcomeReason } = determineOutcome(stages);

      if (input.summaryOnly) {
        builtResults.push({
          articleId: article.flattened.id,
          articleIdHash: article.flattened.idHash,
          articleTitle: article.flattened.title || null,
          outcome,
          outcomeReason,
        });
      } else {
        builtResults.push({
          articleId: article.flattened.id,
          articleIdHash: article.flattened.idHash,
          articleTitle: article.flattened.title || null,
          outcome,
          outcomeReason,
          stages,
        });
      }
    }

    return builtResults;
  });

  return { results, errors: [] };
}
