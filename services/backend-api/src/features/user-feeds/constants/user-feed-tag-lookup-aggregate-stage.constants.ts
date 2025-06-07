import { PipelineStage, Types } from "mongoose";

export const getUserFeedTagLookupAggregateStage = (
  userId: Types.ObjectId
): PipelineStage => {
  return {
    $lookup: {
      from: "user_feed_tags",
      as: "userTags",
      let: {
        feedId: "$_id",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$userId", userId] },
                { $in: ["$$feedId", "$feedIds"] },
              ],
            },
          },
        },
        {
          $project: {
            _id: 1,
            label: 1,
            color: 1,
          },
        },
      ],
    },
  };
};
