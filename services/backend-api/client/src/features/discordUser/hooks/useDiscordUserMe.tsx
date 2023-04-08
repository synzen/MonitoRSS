import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getDiscordMe, GetDiscordMeOutput } from "../api";

interface Options {
  enabled?: boolean;
}

export const useDiscordUserMe = ({ enabled }: Options) => {
  const { data, status, error } = useQuery<GetDiscordMeOutput, ApiAdapterError>(
    ["discord-user-me"],
    async () => getDiscordMe(),
    {
      enabled,
    }
  );

  return {
    data,
    status,
    error,
  };
};
