import { useEffect } from "react";
import { Button, Icon } from "@chakra-ui/react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { useUserMe } from "../../hooks";
import { openRedditLogin } from "@/utils/openRedditLogin";

interface Props {
  size?: "sm" | "md" | "lg";
  colorPalette?: string;
  /**
   * "primary" renders a solid accent fill for use as the main action of a prompt (the mandatory
   * connection gate). Omit for the default low-emphasis button (settings, rate-limit hint).
   */
  emphasis?: "primary";
  onConnected?: () => void;
  /**
   * Connect on behalf of a workspace instead of the caller's personal account. The grant is
   * stored on the workspace, so the connected/reconnect state comes from the workspace's
   * connection (passed in by the caller — this component cannot read workspace state itself),
   * and `refresh` re-fetches it after the popup completes.
   */
  workspace?: {
    id: string;
    /** null = the workspace has no connection record. */
    connectionStatus: "ACTIVE" | "REVOKED" | null;
    refresh: () => void;
  };
}

export const RedditLoginButton = ({
  size,
  colorPalette,
  emphasis,
  onConnected,
  workspace,
}: Props) => {
  const { data, refetch, fetchStatus } = useUserMe();

  const redditAccount = data?.result.externalAccounts?.find((e) => e.type === "reddit");
  // A revoked/expired account record still exists, so "is there a record" is the wrong signal for a
  // successful connection - it would fire onConnected (and any retry it drives) while the account is
  // still unusable, re-hitting the server-side gate. Only an ACTIVE account is actually connected.
  const hasConnectionRecord = workspace ? workspace.connectionStatus !== null : !!redditAccount;
  const isRedditActive = workspace
    ? workspace.connectionStatus === "ACTIVE"
    : redditAccount?.status === "ACTIVE";

  useEffect(() => {
    const messageListener = (e: MessageEvent) => {
      if (e.data === "reddit") {
        if (workspace) {
          workspace.refresh();
        } else {
          refetch();
        }
      }
    };

    window.addEventListener("message", messageListener);

    return () => {
      window.removeEventListener("message", messageListener);
    };
  }, [workspace?.id]);

  useEffect(() => {
    if (isRedditActive) {
      onConnected?.();
    }
  }, [isRedditActive]);

  return (
    <Button
      size={size || "sm"}
      variant={emphasis === "primary" ? "solid" : undefined}
      aria-disabled={fetchStatus === "fetching"}
      onClick={() => {
        if (fetchStatus === "fetching") {
          return;
        }

        openRedditLogin(workspace?.id);
      }}
      colorPalette={emphasis === "primary" ? "brand" : colorPalette}
      aria-label={
        hasConnectionRecord ? "Reconnect Reddit in popup window" : "Connect Reddit in popup window"
      }
    >
      {hasConnectionRecord ? "Reconnect" : "Connect"}
      <Icon as={FaUpRightFromSquare} />
    </Button>
  );
};
