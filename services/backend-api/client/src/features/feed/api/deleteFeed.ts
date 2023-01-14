import fetchRest from "@/utils/fetchRest";

export interface DeleteFeedInput {
  feedId: string;
}

export const deleteFeed = async (options: DeleteFeedInput): Promise<void> => {
  await fetchRest(`/api/v1/feeds/${options.feedId}`, {
    requestOptions: {
      method: "DELETE",
    },
    skipJsonParse: true,
  });
};
