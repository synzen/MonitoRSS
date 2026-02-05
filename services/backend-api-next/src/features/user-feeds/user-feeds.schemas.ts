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

export enum UpdateUserFeedsOp {
  BulkDelete = "bulk-delete",
  BulkDisable = "bulk-disable",
  BulkEnable = "bulk-enable",
}

export interface UpdateUserFeedsBody {
  op: UpdateUserFeedsOp;
  data: {
    feeds: Array<{ id: string }>;
  };
}

export const updateUserFeedsBodySchema = {
  type: "object",
  required: ["op", "data"],
  additionalProperties: false,
  properties: {
    op: {
      type: "string",
      enum: Object.values(UpdateUserFeedsOp),
    },
    data: {
      type: "object",
      required: ["feeds"],
      additionalProperties: false,
      properties: {
        feeds: {
          type: "array",
          items: {
            type: "object",
            required: ["id"],
            additionalProperties: false,
            properties: {
              id: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
  },
};
