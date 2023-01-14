import fetchRest from "@/utils/fetchRest";

export interface DeleteUserFeedInput {
  feedId: string;
}

export const deleteUserFeed = async (options: DeleteUserFeedInput): Promise<void> => {
  await fetchRest(`/api/v1/user-feeds/${options.feedId}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
