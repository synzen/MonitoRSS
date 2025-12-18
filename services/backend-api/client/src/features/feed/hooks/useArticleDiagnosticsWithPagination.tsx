import { useState, useCallback, useMemo, useEffect } from "react";
import { useArticleDiagnostics } from "./useArticleDiagnostics";
import { ArticleDiagnosticResult } from "../types/ArticleDiagnostics";

interface Props {
  feedId?: string;
  limit?: number;
  disabled?: boolean;
}

export const useArticleDiagnosticsWithPagination = ({ feedId, limit, disabled }: Props) => {
  const [skip, setSkip] = useState(0);
  const [accumulatedResults, setAccumulatedResults] = useState<ArticleDiagnosticResult[]>([]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const useLimit = limit || 10;

  const { error, data, status, fetchStatus, refetch } = useArticleDiagnostics({
    feedId,
    data: {
      skip,
      limit: useLimit,
    },
    disabled,
  });

  // Set lastChecked on initial load
  useEffect(() => {
    if (status === "success" && lastChecked === null) {
      setLastChecked(new Date());
    }
  }, [status, lastChecked]);

  const allResults = useMemo(() => {
    if (!data?.result.results) return accumulatedResults;

    if (skip === 0) {
      return data.result.results;
    }

    const existingIds = new Set(accumulatedResults.map((r) => r.articleId));
    const newResults = data.result.results.filter((r) => !existingIds.has(r.articleId));

    return [...accumulatedResults, ...newResults];
  }, [data?.result.results, accumulatedResults, skip]);

  const loadMore = useCallback(() => {
    if (fetchStatus === "fetching") return;

    setAccumulatedResults(allResults);
    setSkip((prev) => prev + useLimit);
  }, [fetchStatus, allResults, useLimit]);

  const refresh = useCallback(async () => {
    setSkip(0);
    setAccumulatedResults([]);
    await refetch();
    setLastChecked(new Date());
  }, [refetch]);

  const hasMore = data?.result ? allResults.length < data.result.total : false;
  const total = data?.result?.total ?? 0;
  const feedState = data?.result?.feedState;

  return {
    results: allResults,
    error,
    status,
    fetchStatus,
    loadMore,
    refresh,
    hasMore,
    total,
    lastChecked,
    limit: useLimit,
    feedState,
  };
};
