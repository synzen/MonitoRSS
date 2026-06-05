import { useEffect } from "react";
import { Button, Icon } from "@chakra-ui/react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { useUserMe } from "../../hooks";
import { openRedditLogin } from "@/utils/openRedditLogin";

interface Props {
  size?: "sm" | "md" | "lg";
  colorPalette?: string;
  onConnected?: () => void;
}

export const RedditLoginButton = ({ size, colorPalette, onConnected }: Props) => {
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
      colorPalette={colorPalette}
      aria-label={
        redditConnected ? "Reconnect Reddit in popup window" : "Connect Reddit in popup window"
      }
    >
      {redditConnected ? "Reconnect" : "Connect"}
      <Icon as={FaUpRightFromSquare} />
    </Button>
  );
};
