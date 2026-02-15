import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getDiscordUser, GetDiscordUserOutput } from "../api";

interface Input {
  userId: string;
  disabled?: boolean;
}

export const useDiscordUser = (inputData: Input) => {
  const { data, status, error, isFetching } = useQuery<GetDiscordUserOutput, ApiAdapterError>(
    ["discord-user", inputData],
    async () => {
      return getDiscordUser({
        userId: inputData.userId,
      });
    },
    {
      enabled: !inputData.disabled,
    },
  );

  return {
    data,
    status,
    error,
    isFetching,
  };
};
