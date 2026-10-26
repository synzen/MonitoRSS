import { z } from 'zod';
import { URL } from 'url';

const isHttpUrl = (text: string) => {
  try {
    const parsedUrl = new URL(text);

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
};

const httpUrl = z
  .string({ error: 'Must a HTTP URI' })
  .refine(isHttpUrl, 'Must a HTTP URI');

const nestedQueryUrl = z
  .string({ error: 'url must be a string' })
  .min(1, 'url should not be empty');

// Mirrors class-validator's @IsOptional() semantics: absent AND null both
// pass validation. Callers (e.g. user-feeds-next) send explicit nulls for
// fields like lookupDetails.
const optionalize = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((val) => val ?? undefined);

const optionalString = (field: string) =>
  optionalize(z.string({ error: `${field} must be a string` }));

const optionalObject = () => optionalize(z.record(z.string(), z.unknown()));

// The pre-migration validation pipe coerced JSON body values through
// class-transformer's @Type, so numeric and boolean fields also accepted
// their string forms.
const optionalNumber = (field: string) =>
  optionalize(
    z.union([
      z.number({ error: `${field} must be a number` }),
      z
        .string()
        .transform((val) => Number(val))
        .refine((val) => !Number.isNaN(val), {
          error: `${field} must be a number`,
        }),
    ]),
  );

const optionalBoolean = (field: string) =>
  optionalize(
    z.union([
      z.boolean({ error: `${field} must be a boolean` }),
      z
        .string()
        .transform((val) => val.toLowerCase())
        .refine(
          (val): val is 'true' | 'false' => val === 'true' || val === 'false',
          { error: `${field} must be a boolean` },
        )
        .transform((val) => val === 'true'),
    ]),
  );

export const lookupDetailsSchema = optionalize(
  z.object({
    key: z
      .string({ error: 'key must be a string' })
      .min(1, 'key should not be empty'),
    headers: optionalObject(),
  }),
);

export const fetchFeedInputSchema = z.object({
  url: httpUrl,
  lookupDetails: lookupDetailsSchema,
  executeFetch: optionalBoolean('executeFetch'),
  executeFetchIfStale: optionalBoolean('executeFetchIfStale'),
  stalenessThresholdSeconds: optionalNumber('stalenessThresholdSeconds'),
  executeFetchIfNotExists: optionalBoolean('executeFetchIfNotExists'),
  hashToCompare: optionalString('hashToCompare'),
  debug: optionalBoolean('debug'),
});

export const fetchFeedDeliveryPreviewInputSchema = z.object({
  url: httpUrl,
  lookupKey: optionalString('lookupKey'),
  headers: optionalObject(),
  stalenessThresholdSeconds: optionalNumber('stalenessThresholdSeconds'),
  hashToCompare: optionalString('hashToCompare'),
});

// Query params arrive as strings; the pre-migration pipe coerced them with
// class-transformer before validating.
export const getFeedRequestsQuerySchema = z.object({
  limit: z.coerce
    .number({ error: 'limit must be a number' })
    .min(1, 'limit must not be less than 1')
    .max(50, 'limit must not be greater than 50'),
  skip: z.coerce
    .number({ error: 'skip must be a number' })
    .min(0, 'skip must not be less than 0'),
  url: nestedQueryUrl,
  lookupKey: optionalString('lookupKey'),
  afterDate: optionalString('afterDate'),
  beforeDate: optionalString('beforeDate'),
});

export type FetchFeedDetails = {
  requestStatus:
    | 'INTERNAL_ERROR'
    | 'BAD_STATUS_CODE'
    | 'SUCCESS'
    | 'FETCH_ERROR'
    | 'PARSE_ERROR'
    | 'FETCH_TIMEOUT'
    | 'REFUSED_LARGE_FEED'
    | 'MATCHED_HASH'
    | 'INVALID_SSL_CERTIFICATE';
  response?: {
    hash?: string | null;
    statusCode: number;
    body?: string;
  };
};

export type FetchFeedInput = z.infer<typeof fetchFeedInputSchema>;
export type FetchFeedDeliveryPreviewInput = z.infer<
  typeof fetchFeedDeliveryPreviewInputSchema
>;
export type GetFeedRequestsQuery = z.infer<typeof getFeedRequestsQuerySchema>;

export function parseWithMessages<T>(
  schema: z.ZodType<T>,
  input: unknown,
): { success: true; data: T } | { success: false; messages: string[] } {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return {
    success: false,
    messages: parsed.error.issues.map((issue) => String(issue.message)),
  };
}
