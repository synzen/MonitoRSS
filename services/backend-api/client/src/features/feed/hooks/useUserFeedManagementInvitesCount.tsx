import { useQuery } from "@tanstack/react-query";
import { getUserFeedManagementInvitesCount, GetUserFeedManagementInvitesCountOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";

export const useUserFeedManagementInvitesCount = () => {
  const queryKey = ["user-feed-management-invites-count"];

  const { data, status, error } = useQuery<
    GetUserFeedManagementInvitesCountOutput,
    ApiAdapterError
  >(queryKey, () => getUserFeedManagementInvitesCount());

  return {
    data,
    status,
    error,
  };
};
