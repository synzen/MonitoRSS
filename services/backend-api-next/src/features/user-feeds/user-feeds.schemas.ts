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

export interface GetUserFeedParams {
  feedId: string;
}

export const getUserFeedParamsSchema = {
  type: "object",
  required: ["feedId"],
  properties: {
    feedId: { type: "string", minLength: 1 },
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

export interface UpdateUserFeedBody {
  title?: string;
  url?: string;
  disabledCode?: string | null;
  passingComparisons?: string[];
  blockingComparisons?: string[];
  formatOptions?: {
    dateFormat?: string;
    dateTimezone?: string;
    dateLocale?: string;
  };
  dateCheckOptions?: {
    oldArticleDateDiffMsThreshold?: number;
  };
  shareManageOptions?: {
    invites: Array<{ discordUserId: string }>;
  };
  userRefreshRateSeconds?: number | null;
  externalProperties?: Array<{
    id: string;
    sourceField: string;
    label: string;
    cssSelector: string;
  }>;
}

export const SUPPORTED_DATE_LOCALES = [
  "af",
  "am",
  "ar-dz",
  "ar-iq",
  "ar-kw",
  "ar-ly",
  "ar-ma",
  "ar-sa",
  "ar-tn",
  "ar",
  "az",
  "be",
  "bg",
  "bi",
  "bm",
  "bn-bd",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "cs",
  "cv",
  "cy",
  "da",
  "de-at",
  "de-ch",
  "de",
  "dv",
  "el",
  "en-au",
  "en-ca",
  "en-gb",
  "en-ie",
  "en-il",
  "en-in",
  "en-nz",
  "en-sg",
  "en-tt",
  "en",
  "eo",
  "es-do",
  "es",
  "et",
  "eu",
  "fa",
  "fi",
  "fo",
  "fr-ca",
  "fr-ch",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gom-latn",
  "gu",
  "he",
  "hi",
  "hr",
  "ht",
  "hu",
  "hy-am",
  "id",
  "is",
  "it-ch",
  "it",
  "ja",
  "jv",
  "ka",
  "kk",
  "km",
  "kn",
  "ko",
  "ku",
  "ky",
  "lb",
  "lo",
  "lt",
  "lv",
  "me",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms-my",
  "ms",
  "mt",
  "my",
  "nb",
  "ne",
  "nl-be",
  "nl",
  "nn",
  "oc-lnc",
  "pa-in",
  "pl",
  "pt-br",
  "pt",
  "rn",
  "ro",
  "ru",
  "rw",
  "sd",
  "se",
  "si",
  "sk",
  "sl",
  "sq",
  "sr-cyrl",
  "sr",
  "ss",
  "sv-fi",
  "sv",
  "sw",
  "ta",
  "te",
  "tet",
  "tg",
  "th",
  "tk",
  "tl-ph",
  "tlh",
  "tr",
  "tzl",
  "tzm-latn",
  "tzm",
  "ug-cn",
  "uk",
  "ur",
  "uz-latn",
  "uz",
  "vi",
  "x-pseudo",
  "yo",
  "zh-cn",
  "zh-hk",
  "zh-tw",
  "zh",
  "es-pr",
  "es-mx",
  "es-us",
] as const;

export const updateUserFeedBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1 },
    url: { type: "string", minLength: 1 },
    disabledCode: { type: ["string", "null"], enum: ["MANUAL", null] },
    passingComparisons: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    blockingComparisons: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    formatOptions: {
      type: "object",
      additionalProperties: false,
      properties: {
        dateFormat: { type: "string" },
        dateTimezone: { type: "string" },
        dateLocale: { type: "string", enum: ["", ...SUPPORTED_DATE_LOCALES] },
      },
    },
    dateCheckOptions: {
      type: "object",
      additionalProperties: false,
      properties: {
        oldArticleDateDiffMsThreshold: { type: "integer", minimum: 0 },
      },
    },
    shareManageOptions: {
      type: "object",
      additionalProperties: false,
      required: ["invites"],
      properties: {
        invites: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["discordUserId"],
            properties: {
              discordUserId: { type: "string", minLength: 1 },
            },
          },
        },
      },
    },
    userRefreshRateSeconds: { type: ["integer", "null"], minimum: 1 },
    externalProperties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "sourceField", "label", "cssSelector"],
        properties: {
          id: { type: "string", minLength: 1 },
          sourceField: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          cssSelector: { type: "string", minLength: 1 },
        },
      },
    },
  },
};

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
