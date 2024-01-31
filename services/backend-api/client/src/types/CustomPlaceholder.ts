import { InferType, array, bool, mixed, object, string } from "yup";
import dayjs from "dayjs";
import { CustomPlaceholderStepType } from "../constants/customPlaceholderStepType";

const RegexStep = object({
  id: string().required(),
  type: string()
    .optional()
    .oneOf([CustomPlaceholderStepType.Regex])
    .default(CustomPlaceholderStepType.Regex),
  regexSearch: string()
    .required("This is a required field")
    .test("is-regex", function testValue(v) {
      try {
        RegExp(v);

        return true;
      } catch (err) {
        return this.createError({
          message: `Must be a valid regex (error: ${(err as Error).message})`,
          path: this.path,
        });
      }
    }),
  regexSearchFlags: string().nullable(),
  replacementString: string()
    .nullable()
    .default("")
    .transform((v) => (!v ? "" : v)),
}).required();

const UrlEncodeStep = object({
  id: string().required(),
  type: string().oneOf([CustomPlaceholderStepType.UrlEncode]).required(),
}).required();

const DateFormatStep = object({
  id: string().required(),
  type: string().oneOf([CustomPlaceholderStepType.DateFormat]).required(),
  format: string().required(),
  timezone: string().test("is-timezone", "Must be a valid timezone", (val) => {
    if (!val) {
      return true;
    }

    try {
      dayjs().tz(val);

      return true;
    } catch (err) {
      if (err instanceof RangeError) {
        return false;
      }

      throw err;
    }
  }),
  locale: string(),
}).required();

export const CustomPlaceholderSchema = object({
  id: string().required("This is a required field"),
  isNew: bool(), // Just used on client side to see what is new
  referenceName: string().required("This is a required field"),
  sourcePlaceholder: string().required("This is a required field"),
  steps: array(
    mixed<
      | InferType<typeof RegexStep>
      | InferType<typeof UrlEncodeStep>
      | InferType<typeof DateFormatStep>
    >()
      .test(
        "shape",
        "invalid",
        (data) =>
          RegexStep.isValidSync(data) ||
          UrlEncodeStep.isValidSync(data) ||
          DateFormatStep.isValidSync(data)
      )
      .required()
  ).required(),
});

export type CustomPlaceholder = InferType<typeof CustomPlaceholderSchema>;
export type CustomPlaceholderRegexStep = InferType<typeof RegexStep>;
export type CustomPlaceholderUrlEncodeStep = InferType<typeof UrlEncodeStep>;
export type CustomPlaceholderDateFormatStep = InferType<typeof DateFormatStep>;
