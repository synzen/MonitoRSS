import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { GetDiscordWebhookOutput, getDiscordWebhook } from "../api";

interface Props {
  webhookId?: string;
}

export const useDiscordWebhook = ({ webhookId }: Props) => {
  const { data, status, error, fetchStatus } = useQuery<GetDiscordWebhookOutput, ApiAdapterError>(
    {
      queryKey: [
        "discord-webhook",
        {
          webhookId,
        },
      ],
      queryFn: async () => {
        if (!webhookId) {
          throw new Error("Missing webhook ID when getting webhooks");
        }

        return getDiscordWebhook({
          webhookId,
        });
      },
      enabled: !!webhookId,
    },
  );

  return {
    data,
    status,
    fetchStatus,
    error,
  };
};
