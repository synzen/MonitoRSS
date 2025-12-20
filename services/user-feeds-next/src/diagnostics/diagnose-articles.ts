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
  CANONICAL_STAGES,
  DiagnosticStage,
  DiagnosticStageStatus,
  type ArticleDiagnosticResult,
  type ArticleDiagnosisSummary,
  type DiagnoseArticlesResponse,
  type DiagnosticStageResult,
  type FeedRateLimitDiagnosticResult,
  type MediumRateLimitDiagnosticResult,
  type MediumDiagnosticResult,
  type MediumDiagnosisSummary,
} from "./types";
import { buildCompleteStageList } from "./stage-builder";

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
 * Stages that apply to all mediums (shared/article-level stages)
 */
const SHARED_STAGES = new Set([
  DiagnosticStage.FeedState,
  DiagnosticStage.IdComparison,
  DiagnosticStage.BlockingComparison,
  DiagnosticStage.PassingComparison,
  DiagnosticStage.DateCheck,
  DiagnosticStage.FeedRateLimit,
]);

/**
 * Separate stages into shared (article-level) and medium-specific stages
 */
function separateStages(stages: DiagnosticStageResult[]): {
  sharedStages: DiagnosticStageResult[];
  mediumStagesMap: Map<string, DiagnosticStageResult[]>;
} {
  const sharedStages: DiagnosticStageResult[] = [];
  const mediumStagesMap = new Map<string, DiagnosticStageResult[]>();

  for (const stage of stages) {
    if (SHARED_STAGES.has(stage.stage)) {
      sharedStages.push(stage);
    } else if (
      stage.stage === DiagnosticStage.MediumFilter ||
      stage.stage === DiagnosticStage.MediumRateLimit
    ) {
      const mediumId =
        stage.details && "mediumId" in stage.details ? (stage.details.mediumId as string) : null;
      if (mediumId) {
        const existing = mediumStagesMap.get(mediumId) || [];
        existing.push(stage);
        mediumStagesMap.set(mediumId, existing);
      }
    }
  }

  return { sharedStages, mediumStagesMap };
}

/**
 * Check if a stage has failed status.
 */
function isFailed(stage: DiagnosticStageResult): boolean {
  return stage.status === DiagnosticStageStatus.Failed;
}

/**
 * Check if a stage has passed status.
 */
function isPassed(stage: DiagnosticStageResult): boolean {
  return stage.status === DiagnosticStageStatus.Passed;
}

/**
 * Determine the diagnosis outcome based on recorded diagnostic stages.
 */
function determineOutcome(
  stages: DiagnosticStageResult[]
): { outcome: ArticleDiagnosisOutcome; outcomeReason: string } {
  // Check FeedState for first run
  const feedState = stages.find((s) => s.stage === DiagnosticStage.FeedState);
  if (feedState && feedState.details && "isFirstRun" in feedState.details && feedState.details.isFirstRun) {
    return {
      outcome: ArticleDiagnosisOutcome.FirstRunBaseline,
      outcomeReason: "Feed has no prior articles stored. This is a first-run baseline - all current articles will be stored but not delivered.",
    };
  }

  // Check IdComparison for duplicate
  const idComparison = stages.find(
    (s) => s.stage === DiagnosticStage.IdComparison
  );
  if (idComparison && isFailed(idComparison)) {
    // Check if there's a passing comparison that allows delivery
    const passingComparison = stages.find(
      (s) => s.stage === DiagnosticStage.PassingComparison
    );
    if (passingComparison && isPassed(passingComparison)) {
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
  if (blockingComparison && isFailed(blockingComparison)) {
    const blockedByFields =
      blockingComparison.details && "blockedByFields" in blockingComparison.details
        ? (blockingComparison.details.blockedByFields as string[]).join(", ")
        : "unknown fields";
    return {
      outcome: ArticleDiagnosisOutcome.BlockedByComparison,
      outcomeReason: `Article blocked by comparison field(s): ${blockedByFields}`,
    };
  }

  // Check DateCheck
  const dateCheck = stages.find((s) => s.stage === DiagnosticStage.DateCheck);
  if (dateCheck && isFailed(dateCheck)) {
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
  if (feedRateLimit && isFailed(feedRateLimit)) {
    return {
      outcome: ArticleDiagnosisOutcome.RateLimitedFeed,
      outcomeReason: "Feed has reached its daily article delivery limit.",
    };
  }

  // Check medium rate limits
  const exceededMediumRateLimit = stages.find(
    (s): s is MediumRateLimitDiagnosticResult =>
      s.stage === DiagnosticStage.MediumRateLimit && isFailed(s)
  );
  if (exceededMediumRateLimit) {
    return {
      outcome: ArticleDiagnosisOutcome.RateLimitedMedium,
      outcomeReason: "This connection has reached its rate limit.",
    };
  }

  // Check medium filters
  const mediumFilter = stages.find(
    (s) => s.stage === DiagnosticStage.MediumFilter
  );
  if (mediumFilter && isFailed(mediumFilter)) {
    return {
      outcome: ArticleDiagnosisOutcome.FilteredByMediumFilter,
      outcomeReason: "Article filtered out by this connection's filter expression.",
    };
  }

  // Article would be delivered
  return {
    outcome: ArticleDiagnosisOutcome.WouldDeliver,
    outcomeReason: "Article passes all checks and would be delivered.",
  };
}

/**
 * Priority order for aggregating outcomes across mediums (higher index = worse/takes precedence)
 */
const OUTCOME_PRIORITY: ArticleDiagnosisOutcome[] = [
  ArticleDiagnosisOutcome.WouldDeliver,
  ArticleDiagnosisOutcome.WouldDeliverPassingComparison,
  ArticleDiagnosisOutcome.FilteredByMediumFilter,
  ArticleDiagnosisOutcome.RateLimitedMedium,
  ArticleDiagnosisOutcome.FilteredByDateCheck,
  ArticleDiagnosisOutcome.RateLimitedFeed,
  ArticleDiagnosisOutcome.BlockedByComparison,
  ArticleDiagnosisOutcome.DuplicateId,
  ArticleDiagnosisOutcome.FirstRunBaseline,
  ArticleDiagnosisOutcome.FeedUnchanged,
  ArticleDiagnosisOutcome.FeedError,
];

/**
 * Compute aggregate article-level outcome from per-medium outcomes.
 * Returns MixedResults if mediums have different outcomes, otherwise returns any medium's outcome.
 */
function computeAggregateOutcome(
  mediumResults: Array<{ outcome: ArticleDiagnosisOutcome; outcomeReason: string }>
): { outcome: ArticleDiagnosisOutcome; outcomeReason: string } {
  if (mediumResults.length === 0) {
    return {
      outcome: ArticleDiagnosisOutcome.WouldDeliver,
      outcomeReason: "No connections configured.",
    };
  }

  // Check if all mediums have the same outcome
  const uniqueOutcomes = new Set(mediumResults.map(m => m.outcome));
  const hasMixedResults = uniqueOutcomes.size > 1;

  if (hasMixedResults) {
    return {
      outcome: ArticleDiagnosisOutcome.MixedResults,
      outcomeReason: "Mixed results across connections.",
    };
  }

  // All mediums have the same outcome - return any of them
  return {
    outcome: mediumResults[0]!.outcome,
    outcomeReason: mediumResults[0]!.outcomeReason,
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
    return { results: [], errors: [], stages: CANONICAL_STAGES };
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
      const allStages = getDiagnosticResultsForArticle(article.flattened.idHash);
      const { sharedStages, mediumStagesMap } = separateStages(allStages);

      // Build per-medium results
      const mediumResults: (MediumDiagnosticResult | MediumDiagnosisSummary)[] = [];

      for (const medium of input.mediums) {
        const mediumSpecificStages = mediumStagesMap.get(medium.id) || [];
        const combinedStages = [...sharedStages, ...mediumSpecificStages];
        // Fill in skipped stages to return complete list
        const completeStages = buildCompleteStageList(combinedStages);
        const { outcome, outcomeReason } = determineOutcome(completeStages);

        if (input.summaryOnly) {
          mediumResults.push({
            mediumId: medium.id,
            outcome,
            outcomeReason,
          });
        } else {
          mediumResults.push({
            mediumId: medium.id,
            outcome,
            outcomeReason,
            stages: completeStages,
          });
        }
      }

      // Compute aggregate article-level outcome
      const { outcome: articleOutcome, outcomeReason: articleOutcomeReason } =
        computeAggregateOutcome(mediumResults);

      builtResults.push({
        articleId: article.flattened.id,
        articleIdHash: article.flattened.idHash,
        articleTitle: article.flattened.title || null,
        outcome: articleOutcome,
        outcomeReason: articleOutcomeReason,
        mediumResults,
      });
    }

    return builtResults;
  });

  return { results, errors: [], stages: CANONICAL_STAGES };
}
