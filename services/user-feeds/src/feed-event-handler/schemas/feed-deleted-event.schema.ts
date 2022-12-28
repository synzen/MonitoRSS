import { object, string } from "yup";

export const feedDeletedEventSchema = object().shape({
  data: object()
    .shape({
      feed: object({
        id: string().required(),
      }),
    })
    .required(),
});
