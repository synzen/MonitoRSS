import { InferType, array, bool, object, string } from "yup";

export const CustomPlaceholderSchema = object({
  id: string().required("This is a required field"),
  isNew: bool(), // Just used on client side to see what is new
  referenceName: string().required("This is a required field"),
  sourcePlaceholder: string().required("This is a required field"),
  steps: array(
    object({
      id: string().required(),
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
    }).required()
  ).required(),
});

export type CustomPlaceholder = InferType<typeof CustomPlaceholderSchema>;
