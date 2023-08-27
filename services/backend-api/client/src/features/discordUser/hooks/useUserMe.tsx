import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import { getUserMe, GetUserMeOutput } from "../api";

export const useUserMe = () => {
  const { data, status, error } = useQuery<GetUserMeOutput, ApiAdapterError>(
    ["user-me"],
    async () => getUserMe()
  );

  return {
    data,
    status,
    error,
  };
};
