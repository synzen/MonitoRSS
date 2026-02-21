export type FeedActionState =
  | { status: "default" }
  | { status: "adding" }
  | { status: "added"; settingsUrl: string }
  | { status: "error"; message?: string; errorCode?: string }
  | { status: "limit-reached" };

export function getFeedCardPropsFromState(
  feedActionStates: Record<string, FeedActionState>,
  feedUrl: string,
  isAtLimit: boolean,
): {
  state: "default" | "adding" | "added" | "error" | "limit-reached";
  errorMessage?: string;
  errorCode?: string;
  feedSettingsUrl?: string;
} {
  const actionState = feedActionStates[feedUrl];

  if (!actionState) {
    return { state: isAtLimit ? "limit-reached" : "default" };
  }

  if (isAtLimit && actionState.status !== "added" && actionState.status !== "adding") {
    return { state: "limit-reached" };
  }

  switch (actionState.status) {
    case "error":
      return {
        state: "error",
        errorMessage: actionState.message,
        errorCode: actionState.errorCode,
      };
    case "added":
      return {
        state: "added",
        feedSettingsUrl: actionState.settingsUrl,
      };
    default:
      return { state: actionState.status };
  }
}
