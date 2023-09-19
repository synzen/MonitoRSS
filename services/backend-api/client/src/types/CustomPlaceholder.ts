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
        .test({
          test: (value) => {
            try {
              RegExp(value);

              return true;
            } catch (err) {
              return false;
            }
          },
          message: "Must be a valid regex",
        }),
      replacementString: string()
        .nullable()
        .default("")
        .transform((v) => (!v ? "" : v)),
    }).required()
  ).required(),
});

export type CustomPlaceholder = InferType<typeof CustomPlaceholderSchema>;
