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
   * connection (passed in by the caller — this component cannot read workspace state itself).
   */
  workspace?: {
    id: string;
    /** null = the workspace has no connection record. */
    connectionStatus: "ACTIVE" | "REVOKED" | null;
  };
  /**
   * In-app path the OAuth round trip redirects back to. Defaults to the current location;
   * flows whose restore target differs from the current URL (e.g. re-opening the add-feed
   * modal from a deep link) pass it explicitly.
   */
  returnTo?: string;
}

export const RedditLoginButton = ({
  size,
  colorPalette,
  emphasis,
  onConnected,
  workspace,
  returnTo,
}: Props) => {
  const { data, fetchStatus } = useUserMe();

  const redditAccount = data?.result.externalAccounts?.find((e) => e.type === "reddit");
  // A revoked/expired account record still exists, so "is there a record" is the wrong signal for a
  // successful connection - it would fire onConnected (and any retry it drives) while the account is
  // still unusable, re-hitting the server-side gate. Only an ACTIVE account is actually connected.
  const hasConnectionRecord = workspace ? workspace.connectionStatus !== null : !!redditAccount;
  const isRedditActive = workspace
    ? workspace.connectionStatus === "ACTIVE"
    : redditAccount?.status === "ACTIVE";

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

        openRedditLogin(workspace?.id, returnTo);
      }}
      colorPalette={emphasis === "primary" ? "brand" : colorPalette}
      aria-label={hasConnectionRecord ? "Reconnect Reddit" : "Connect Reddit"}
    >
      {hasConnectionRecord ? "Reconnect" : "Connect"}
      <Icon as={FaUpRightFromSquare} />
    </Button>
  );
};
