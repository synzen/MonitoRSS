import { useEffect } from "react";
import { Button } from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { useUserMe } from "../../features/discordUser";
import { openRedditLogin } from "../../utils/openRedditLogin";

interface Props {
  size?: "sm" | "md" | "lg";
  colorScheme?: string;
  onConnected?: () => void;
}

export const RedditLoginButton = ({ size, colorScheme, onConnected }: Props) => {
  const { data, refetch, fetchStatus } = useUserMe();

  const redditConnected = data?.result.externalAccounts?.find((e) => e.type === "reddit");

  useEffect(() => {
    const messageListener = (e: MessageEvent) => {
      if (e.data === "reddit") {
        refetch();
      }
    };

    window.addEventListener("message", messageListener);

    return () => {
      window.removeEventListener("message", messageListener);
    };
  }, []);

  useEffect(() => {
    if (redditConnected) {
      onConnected?.();
    }
  }, [redditConnected]);

  return (
    <Button
      size={size || "sm"}
      aria-disabled={fetchStatus === "fetching"}
      onClick={() => {
        if (fetchStatus === "fetching") {
          return;
        }

        openRedditLogin();
      }}
      colorScheme={colorScheme}
      rightIcon={<ExternalLinkIcon />}
      aria-label={
        redditConnected ? "Reconnect Reddit in popup window" : "Connect Reddit in popup window"
      }
    >
      {redditConnected ? "Reconnect" : "Connect"}
    </Button>
  );
};
