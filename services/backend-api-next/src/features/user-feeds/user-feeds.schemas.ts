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

export interface DeduplicateFeedUrlsBody {
  urls: string[];
}

export const deduplicateFeedUrlsBodySchema = {
  type: "object",
  required: ["urls"],
  properties: {
    urls: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
};

export interface ValidateUrlBody {
  url: string;
}

export const validateUrlBodySchema = {
  type: "object",
  required: ["url"],
  properties: {
    url: { type: "string", minLength: 1 },
  },
};
