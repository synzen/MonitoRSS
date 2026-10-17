import { useQuery } from "@tanstack/react-query";
import { getUserFeedManagementInvites, GetUserFeedManagementInvitesOutput } from "../api";
import ApiAdapterError from "../../../utils/ApiAdapterError";

export const useUserFeedManagementInvites = () => {
  const queryKey = ["user-feed-management-invites"];

  const { data, status, error } = useQuery<GetUserFeedManagementInvitesOutput, ApiAdapterError>({
    queryKey,
    queryFn: () => getUserFeedManagementInvites(),
  });

  return {
    data,
    status,
    error,
  };
};
