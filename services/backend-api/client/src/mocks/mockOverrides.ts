const SLOW_MS = 4000;
const LOADING_MS = 30000;

function getSearchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

export function mockHasFlag(name: string): boolean {
  return getSearchParams().has(name);
}

export function pickMockDelayMs(options: {
  slowFlag?: string;
  loadingFlag?: string;
  defaultMs: number;
}): number {
  if (options.loadingFlag && mockHasFlag(options.loadingFlag)) {
    return LOADING_MS;
  }

  if (options.slowFlag && mockHasFlag(options.slowFlag)) {
    return SLOW_MS;
  }

  return options.defaultMs;
}
