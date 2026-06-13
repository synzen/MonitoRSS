import { useUserMe } from "@/features/discordUser";

// Both layers must be true: the deployment capability and the per-user rollout
// flag. UX gate only — the backend re-enforces both.
export const useIsWorkspacesEnabled = () => {
  const { data, status, fetchStatus } = useUserMe();

  const enabled = !!(data?.result.capabilities?.workspaces && data?.result.featureFlags?.workspaces);

  return {
    enabled,
    status,
    fetchStatus,
  };
};
