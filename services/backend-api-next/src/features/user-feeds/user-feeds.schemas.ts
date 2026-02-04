export interface CreateUserFeedBody {
  url: string;
  title?: string;
  sourceFeedId?: string;
}

export const createUserFeedBodySchema = {
  type: "object",
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1 },
    title: { type: "string" },
    sourceFeedId: { type: "string" },
  },
};
